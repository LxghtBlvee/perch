import type { Container } from '@perch/types'

const DOCKER_SOCKET = '/var/run/docker.sock'

async function dockerFetch<T>(path: string): Promise<T> {
    const res = await fetch(`http://localhost${path}`, {
        unix: DOCKER_SOCKET,
    })
    if (!res.ok) throw new Error(`Docker API ${path} returned ${res.status}`)
    return res.json() as Promise<T>
}

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

export async function collectContainers(): Promise<Container[]> {
    try {
        const list = await dockerFetch<DockerContainer[]>('/containers/json?all=true')

        return Promise.all(
            list.map(async (c): Promise<Container> => {
                let cpu = 0;
                let memUsed = 0;
                let memLimit = 0;

                if (c.State === 'running') {
                    try {
                        const stats = await dockerFetch<DockerStats>(`/containers/${c.Id}/stats?stream=false`)
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
        return [] // docker unavil or not installed
    }
}