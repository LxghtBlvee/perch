import type { Container } from '@perch/types'
import type { ContainerCollector } from './collector'
import { DockerCollector } from './docker'

/**
 * Holds every container runtime the agent knows how to talk to, probes which
 * are actually present on this host, and presents a single merged view to the
 * rest of the agent.
 *
 * This is the runtime-agnostic seam: `index.ts` and `connection.ts` only ever
 * touch the registry, never a specific runtime. New runtimes (Podman, LXD,
 * Kubernetes, ...) are added by pushing another collector into `candidates`.
 */
export class CollectorRegistry {
    // Every collector we could potentially use, before availability probing.
    private readonly candidates: ContainerCollector[] = [
        new DockerCollector('docker'),
        // Future runtimes plug in here, e.g.:
        // new DockerCollector('podman', '/run/podman/podman.sock'),
        // new LxdCollector(),
        // new KubernetesCollector(),
    ]

    // Collectors that responded during detection.
    private active: ContainerCollector[] = []

    // containerId -> the collector that produced it, rebuilt every collect cycle
    // so log requests are routed back to the right runtime.
    private ownership = new Map<string, ContainerCollector>()

    /** Probe each candidate runtime once; keep the ones that are reachable. */
    async detect(): Promise<void> {
        const results = await Promise.all(
            this.candidates.map(async (c) => ({ c, ok: await c.isAvailable() })),
        )
        this.active = results.filter((r) => r.ok).map((r) => r.c)
        console.warn(
            `Container runtimes detected: ${
                this.active.length ? this.active.map((c) => c.runtime).join(', ') : 'none'
            }`,
        )
    }

    /** Collect from every active runtime and merge into one normalized list. */
    async collect(): Promise<Container[]> {
        const ownership = new Map<string, ContainerCollector>()
        const lists = await Promise.all(
            this.active.map(async (collector) => {
                const containers = await collector.collect()
                for (const c of containers) ownership.set(c.id, collector)
                return containers
            }),
        )
        this.ownership = ownership
        return lists.flat()
    }

    /** Route a follow/stream request to the collector that owns the container. */
    async streamLogs(
        containerId: string,
        tail: number,
        onLine: (line: string) => void,
        signal: AbortSignal,
    ): Promise<void> {
        return this.ownerOf(containerId).streamLogs(containerId, tail, onLine, signal)
    }

    private ownerOf(containerId: string): ContainerCollector {
        const owner = this.ownership.get(containerId)
        if (!owner) throw new Error(`no runtime owns container ${containerId}`)
        return owner
    }
}
