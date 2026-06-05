import * as os from 'os'
import { randomUUID } from 'crypto'
import { config } from './config/config.validation'
import { AgentConnection } from './connection'
import { collectSystemMetrics } from './collectors/system'
import { collectContainers } from './collectors/docker'

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

const connection = new AgentConnection(agentId, hostname, ip)
connection.connect()

setInterval(async () => {
  if (!connection.isConnected()) return

  const [metrics, containers] = await Promise.all([
    collectSystemMetrics(agentId),
    collectContainers(),
  ])

  connection.send({ type: 'metrics', data: metrics })
  connection.send({ type: 'containers', data: containers })
}, config.interval)