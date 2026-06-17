import type { Container, ContainerRuntime } from '@perch/types'
import type { ContainerCollector } from './collector'

const DEFAULT_DOCKER_SOCKET = '/var/run/docker.sock'

interface DockerContainer {
    Id: string;
    Names: string[];
    Image: string;
    State: string;
    Status: string;
    Created: number;
    Ports: Array<{ PublicPort?: number; PrivatePort: number; Type: string }> | null;
};

interface DockerStats {
    cpu_stats: {
        cpu_usage: { total_usage: number };
        system_cpu_usage: number;
        online_cpus: number;
    };
    precpu_stats: {
        cpu_usage: { total_usage: number };
        system_cpu_usage: number;
    };
    memory_stats: {
        usage: number;
        limit: number;
    };
};

function mapState(state: string): Container['status'] {
    switch (state) {
        case 'running': return 'running';
        case 'exited': return 'stopped';
        case 'paused': return 'paused';
        case 'restarting': return 'restarting';
        default: return 'dead';
    };
};

/**
 * Collector for the Docker Engine API over a unix socket.
 *
 * Podman exposes a Docker-compatible REST API on its own socket, so this same
 * collector covers Podman by constructing it with that socket path and the
 * `'podman'` runtime tag — no other changes required.
 */
export class DockerCollector implements ContainerCollector {
    constructor(
        readonly runtime: ContainerRuntime = 'docker',
        private readonly socket: string = DEFAULT_DOCKER_SOCKET,
    ) {}

    private async fetch<T>(path: string): Promise<T> {
        const res = await fetch(`http://localhost${path}`, {
            unix: this.socket,
        })
        if (!res.ok) throw new Error(`${this.runtime} API ${path} returned ${res.status}`)
        return res.json() as Promise<T>
    }

    async isAvailable(): Promise<boolean> {
        try {
            // /_ping responds with plain-text "OK", not JSON — don't use the
            // JSON fetch helper here or parsing throws and hides a live socket.
            const res = await fetch(`http://localhost/_ping`, { unix: this.socket })
            return res.ok
        } catch {
            return false
        }
    }

    async collect(): Promise<Container[]> {
        try {
            const list = await this.fetch<DockerContainer[]>('/containers/json?all=true')

            return Promise.all(
                list.map(async (c): Promise<Container> => {
                    let cpu = 0;
                    let memUsed = 0;
                    let memLimit = 0;

                    if (c.State === 'running') {
                        try {
                            const stats = await this.fetch<DockerStats>(`/containers/${c.Id}/stats?stream=false`)
                            const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
                            const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
                            cpu = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100
                            memUsed = stats.memory_stats.usage;
                            memLimit = stats.memory_stats.limit;
                        } catch {
                            // container may have stopped between list and stats fetch
                        }
                    }

                    return {
                        id: c.Id.slice(0, 12),
                        runtime: this.runtime,
                        name: c.Names[0]?.replace(/^\//, '') ?? c.Id.slice(0, 12),
                        image: c.Image,
                        status: mapState(c.State),
                        state: c.Status,
                        createdAt: new Date(c.Created * 1000).toISOString(),
                        ports: (c.Ports ?? []).map(p => ({
                            hostPort: p.PublicPort ?? 0,
                            containerPort: p.PrivatePort,
                            protocol: p.Type,
                        })),
                        cpu: Math.round(cpu * 100) / 100,
                        memory: { used: memUsed, limit: memLimit },
                    }
                })
            )
        } catch {
            return [] // runtime unavailable or not installed
        }
    }

    // Defense in depth: only hex IDs may be interpolated into the API path.
    // Anything else could path-inject into other Engine endpoints.
    private safeId(containerId: string): string {
        if (!/^[a-f0-9]{12,64}$/.test(containerId)) throw new Error('invalid container id')
        return containerId
    }

    private clampTail(tail: number): number {
        return Number.isFinite(tail) ? Math.min(Math.max(Math.trunc(tail), 1), 1000) : 200
    }

    async streamLogs(
        containerId: string,
        tail: number,
        onLine: (line: string) => void,
        signal: AbortSignal,
    ): Promise<void> {
        const id = this.safeId(containerId)
        const res = await fetch(
            `http://localhost/containers/${id}/logs?stdout=1&stderr=1&follow=1&tail=${this.clampTail(tail)}&timestamps=true`,
            { unix: this.socket, signal } as RequestInit,
        )
        if (!res.ok || !res.body) throw new Error(`${this.runtime} log stream returned ${res.status}`)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = new Uint8Array(0)
        let lineBuf = ''
        let mode: 'unknown' | 'multiplexed' | 'raw' = 'unknown'

        const emit = (text: string) => {
            lineBuf += text
            let nl: number
            while ((nl = lineBuf.indexOf('\n')) >= 0) {
                onLine(lineBuf.slice(0, nl).replace(/\r$/, ''))
                lineBuf = lineBuf.slice(nl + 1)
            }
        }

        try {
            for (;;) {
                const { done, value } = await reader.read()
                if (done) break
                if (value) {
                    const next = new Uint8Array(buf.length + value.length)
                    next.set(buf); next.set(value, buf.length)
                    buf = next
                }

                if (mode === 'unknown') {
                    if (buf.length < 8) continue
                    // Multiplexed frames start with a stream-type byte (0/1/2) and 3 zero bytes.
                    mode = buf[0] <= 2 && buf[1] === 0 && buf[2] === 0 && buf[3] === 0 ? 'multiplexed' : 'raw'
                }

                if (mode === 'raw') {
                    emit(decoder.decode(buf, { stream: true }))
                    buf = new Uint8Array(0)
                    continue
                }

                // Multiplexed: consume every complete 8-byte-header frame we have.
                let offset = 0
                while (buf.length - offset >= 8) {
                    const size = ((buf[offset + 4] << 24) | (buf[offset + 5] << 16) | (buf[offset + 6] << 8) | buf[offset + 7]) >>> 0
                    if (buf.length - offset - 8 < size) break // frame split across reads — wait
                    emit(decoder.decode(buf.subarray(offset + 8, offset + 8 + size), { stream: true }))
                    offset += 8 + size
                }
                buf = buf.subarray(offset)
            }
            if (lineBuf.length) onLine(lineBuf.replace(/\r$/, ''))
        } catch (e) {
            // Aborting the stream (caller stopped following) is expected, not an error.
            if (signal.aborted || (e instanceof Error && e.name === 'AbortError')) return
            throw e
        } finally {
            try { await reader.cancel() } catch { /* already closed */ }
        }
    }
}
