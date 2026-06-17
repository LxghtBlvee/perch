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

/** Parse Docker's multiplexed log stream (8-byte header per frame) or raw TTY stream. */
function parseDockerLogs(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    // Detect Docker multiplexed stream (8-byte header per frame)
    if (bytes.length >= 8 && bytes[0] <= 2 && bytes[1] === 0 && bytes[2] === 0 && bytes[3] === 0) {
        const lines: string[] = []
        let offset = 0
        const decoder = new TextDecoder()
        while (offset + 8 <= bytes.length) {
            const size = ((bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7]) >>> 0
            offset += 8
            if (size === 0) continue
            if (offset + size > bytes.length) break
            lines.push(decoder.decode(bytes.slice(offset, offset + size)))
            offset += size
        }
        return lines.join('')
    }
    // Raw stream (TTY mode)
    return new TextDecoder().decode(bytes)
}

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

    async getLogs(containerId: string, tail: number): Promise<string> {
        // Defense in depth: only hex IDs may be interpolated into the API path.
        // Anything else could path-inject into other Engine endpoints.
        if (!/^[a-f0-9]{12,64}$/.test(containerId)) {
            throw new Error('invalid container id')
        }
        const safeTail = Number.isFinite(tail) ? Math.min(Math.max(Math.trunc(tail), 1), 1000) : 200
        const res = await fetch(
            `http://localhost/containers/${containerId}/logs?stdout=1&stderr=1&tail=${safeTail}&timestamps=false`,
            { unix: this.socket } as RequestInit,
        )
        const buffer = await res.arrayBuffer()
        return parseDockerLogs(buffer)
    }
}
