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
     * Fetch recent logs for one container owned by this collector. The
     * collector is responsible for validating that `containerId` is well-formed
     * for its own runtime before interpolating it into any request (defense in
     * depth against path/command injection).
     */
    getLogs(containerId: string, tail: number): Promise<string>
}
