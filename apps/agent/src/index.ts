import * as os from 'os'
import { randomUUID } from 'crypto'
import { config } from './config/config.validation'
import { AgentConnection } from './connection'
import { collectSystemMetrics } from './collectors/system'
import { CollectorRegistry } from './collectors/registry'

async function getAgentId(): Promise<string> {
  try {
    return (await Bun.file(config.agentIdFile).text()).trim()
  } catch {
    const id = randomUUID()
    await Bun.write(config.agentIdFile, id)
    return id
  }
}

function getLocalIp(): string {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const info of ifaces ?? []) {
      if (info.family === 'IPv4' && !info.internal) return info.address
    }
  }
  return '0.0.0.0'
}

const agentId = await getAgentId()
const hostname = os.hostname()
const ip = getLocalIp()

console.warn(`Perch agent starting — id: ${agentId}, host: ${hostname}, ip: ${ip}`)

const registry = new CollectorRegistry()
await registry.detect()

// Report cadence: starts from PERCH_INTERVAL, re-tuned when the hub pushes a
// changed agentReportInterval via auth_ok / config_update.
let reportInterval = config.interval
let reportTimer: ReturnType<typeof setInterval> | null = null

async function report(): Promise<void> {
  if (!connection.isConnected()) return

  const [metrics, containers] = await Promise.all([
    collectSystemMetrics(agentId),
    registry.collect(),
  ])

  connection.send({ type: 'metrics', data: metrics })
  connection.send({ type: 'containers', data: containers })
}

function startReporting(): void {
  if (reportTimer) clearInterval(reportTimer)
  reportTimer = setInterval(() => void report(), reportInterval)
}

const connection = new AgentConnection(
  agentId,
  hostname,
  ip,
  (id, tail, onLine, signal) => registry.streamLogs(id, tail, onLine, signal),
  ({ reportInterval: next }) => {
    if (typeof next === 'number' && next > 0 && next !== reportInterval) {
      reportInterval = next
      console.warn(`Report interval updated to ${reportInterval}ms`)
      startReporting()
    }
  },
)
connection.connect()
startReporting()