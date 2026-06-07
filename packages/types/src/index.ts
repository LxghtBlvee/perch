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

export type DataSourceType = 'prometheus' | 'loki' | 'influxdb' | 'graphite'

export interface DataSource {
  id: string
  name: string
  type: DataSourceType
  url: string
  isDefault: boolean
  createdAt: string
}

// Agent state (agent + latest metrics + containers combined)
export interface AgentState {
  agent: Agent
  metrics: SystemMetrics | null
  containers: Container[]
}

// Auth
export type UserRole = 'member' | 'admin'

export interface AuthUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  role: UserRole
}

export type OAuthProviderType = 'github' | 'google' | 'custom'

export interface OAuthProvider {
  provider: OAuthProviderType
  enabled: boolean
  clientId: string | null
  // clientSecret intentionally omitted from API responses
  customName: string | null
  customAuthorizationUrl: string | null
  customTokenUrl: string | null
  customUserinfoUrl: string | null
  customScopes: string | null
}

// User as returned by admin /api/users endpoint
export interface ManagedUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  role: UserRole
  createdAt: string
}

// Agent → Hub WebSocket messages
export type AgentMessage =
  | { type: 'auth'; token: string; agentId: string; hostname: string; ip: string }
  | { type: 'metrics'; data: SystemMetrics }
  | { type: 'containers'; data: Container[] }
  | { type: 'logs_response'; requestId: string; logs: string }

// Hub → Agent WebSocket messages
export type HubMessage =
  | { type: 'auth_ok'; agentId: string }
  | { type: 'auth_error'; message: string }
  | { type: 'logs_request'; requestId: string; containerId: string; tail: number }

// Hub → Frontend WebSocket messages
export type LiveMessage =
  | { type: 'init'; agents: AgentState[]; healthChecks: HealthCheck[] }
  | { type: 'agent_connected'; agent: AgentState }
  | { type: 'agent_disconnected'; agentId: string }
  | { type: 'metrics_update'; agentId: string; metrics: SystemMetrics }
  | { type: 'containers_update'; agentId: string; containers: Container[] }
  | { type: 'health_check_update'; healthCheck: HealthCheck }