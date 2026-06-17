import type { Container, ContainerRuntime } from '@perch/types'

/**
 * A ContainerCollector knows how to talk to one container runtime (Docker,
 * Podman, LXD, Kubernetes, ...) and normalize its containers into Perch's
 * shared `Container` shape.
 *
 * This mirrors Dozzle's `container.Client` interface: the rest of the agent
 * (and the entire hub) stays runtime-agnostic and only ever sees `Container`.
 * Adding a new runtime means implementing this interface — nothing else in the
 * pipeline changes.
 */
export interface ContainerCollector {
    /** Discriminator stamped onto every Container this collector returns. */
    readonly runtime: ContainerRuntime

    /**
     * Whether this runtime is reachable on the current host (e.g. its socket
     * exists and responds). Checked once at startup so we only poll runtimes
     * that are actually present.
     */
    isAvailable(): Promise<boolean>

    /** Snapshot the runtime's containers, normalized to Perch's `Container`. */
    collect(): Promise<Container[]>

    /**
     * Follow a container's logs, invoking `onLine` for each line (including the
     * last `tail` historical lines first). Resolves when the stream ends; the
     * caller aborts it via `signal`. The collector must validate that
     * `containerId` is well-formed for its runtime before interpolating it into
     * any request (defense in depth against path/command injection).
     */
    streamLogs(
        containerId: string,
        tail: number,
        onLine: (line: string) => void,
        signal: AbortSignal,
    ): Promise<void>
}
