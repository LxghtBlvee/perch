export interface Agent {
    id: string;
    hostname: string;
    displayName: string | null;
    ip: string;
    connectedAt: string;
    lastSeen: string;
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
  hasPassword: boolean
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

// Alerts
export type AlertDestinationType = 'discord' | 'slack' | 'ntfy'
export type AlertRuleType = 'health_check' | 'container_event'
export type HealthCheckTrigger = 'down' | 'up' | 'both'
export type ContainerEventType = 'crash' | 'restart'

export interface AlertDestination {
  id: string
  name: string
  type: AlertDestinationType
  webhookUrl: string
  ntfyTopic: string | null
  ntfyPriority: string | null
  createdAt: string
}

export interface AlertRule {
  id: string
  name: string
  enabled: boolean
  type: AlertRuleType
  // health_check
  healthCheckId: string | null
  onStatus: HealthCheckTrigger | null
  // container_event
  agentId: string | null
  events: ContainerEventType[] | null
  // shared
  cooldown: number
  lastFiredAt: string | null
  destinationId: string
  destination: AlertDestination
  createdAt: string
}

export interface AlertHistoryEntry {
  id: string
  ruleId: string
  triggeredAt: string
  detail: string
  status: 'sent' | 'failed'
  error: string | null
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
  | { type: 'agent_updated'; agentId: string; displayName: string | null }
  | { type: 'metrics_update'; agentId: string; metrics: SystemMetrics }
  | { type: 'containers_update'; agentId: string; containers: Container[] }
  | { type: 'health_check_update'; healthCheck: HealthCheck }