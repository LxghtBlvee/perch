export interface Agent {
    id: string;
    hostname: string;
    ip: string;
    connectedAt: string;
    lastSeen: string
    status: 'online' | 'offline' | 'degraded';
}

export interface CpuMetrics {
    usage: number;
    cores: number;
    model: string;
}

export interface MemoryMetrics {
    total: number;
    used: number;
    free: number;
    swap: {
        total: number;
        used: number;
    }
}
export interface DiskMetrics {
    mountpoint: string;
    filesystem: string;
    total: number;
    used: number;
    free: number;
}

export interface NetworkMetrics {
    interface: string;
    rxBytes: number;
    txBytes: number;
    rxSpeed: number;
    txSpeed: number;
}

export interface SystemMetrics {
    agentId: string;
    timestamp: string;
    cpu: CpuMetrics;
    memory: MemoryMetrics;
    disks: DiskMetrics[];
    network: NetworkMetrics[];
    loadAverage: [number, number, number];
    uptime: number;
}

export interface ContainerPort {
    hostPort: number
    containerPort: number
    protocol: string
}

export interface Container {
    id: string
    name: string
    image: string
    status: 'running' | 'stopped' | 'paused' | 'restarting' | 'dead'
    state: string
    createdAt: string
    ports: ContainerPort[]
    cpu: number
    memory: {
        used: number
        limit: number
  }
}

export interface HealthCheck {
    id: string
    name: string
    url: string
    interval: number
    status: 'up' | 'down' | 'pending'
    lastChecked: string | null
    latency: number | null
}