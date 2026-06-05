import si from 'systeminformation'
import * as os from 'os'
import type { SystemMetrics } from '@perch/types'

export async function collectSystemMetrics(agentId: string): Promise<SystemMetrics> {
    const [cpu, load, mem, disks, networks] = await Promise.all([
        si.cpu(),
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats(),
    ])

    return {
        agentId,
        timestamp: new Date().toISOString(),
        cpu: {
            usage: Math.round(load.currentLoad * 100) / 100,
            cores: cpu.cores,
            model: `${cpu.manufacturer} ${cpu.brand}`.trim(),
        },
        memory: {
            total: mem.total,
            used: mem.active,
            free: mem.free,
            swap: {
                total: mem.swaptotal,
                used: mem.swapused,
            },
        },
        disks: disks.map(d => ({
            mountpoint: d.mount,
            filesystem: d.type,
            total: d.size,
            used: d.used,
            free: d.size - d.used,
        })),
        network: networks.map( n => ({
            interface: n.iface,
            rxBytes: n.rx_bytes,
            txBytes: n.tx_bytes,
            rxSpeed: n.rx_sec ?? 0,
            txSpeed: n.tx_sec ?? 0,
        })),
        loadAverage: os.loadavg() as [number, number, number],
        uptime: os.uptime(),
    }
}