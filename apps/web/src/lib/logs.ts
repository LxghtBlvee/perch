// Client-side log parsing for the Perch log viewer.
//
// Ported (and trimmed) from Dozzle's level guesser + logfmt parser. Perch
// fetches logs as a raw multi-line string, so all parsing happens here: per
// line we strip ANSI, pull off a leading timestamp, detect JSON / logfmt
// structure, and guess a severity level so the UI can colour everything.

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'fatal' | 'unknown'

export interface LogField {
    key: string
    value: string
    /** Coarse type of the original value, used to tint JSON values. */
    type: 'string' | 'number' | 'boolean' | 'null'
}

export type LogKind = 'text' | 'json' | 'logfmt'

export interface ParsedLogLine {
    id: number
    level: LogLevel
    timestamp: string | null
    message: string
    fields: LogField[]
    kind: LogKind
    raw: string
}

// Level guessing (ported from internal/container/level_guesser.go)

const LEVEL_GROUPS: string[][] = [
    ['error', 'err'],
    ['warn', 'warning', 'wrn'],
    ['info', 'inf'],
    ['debug', 'dbg'],
    ['trace', 'verbose', 'ver', 'vbs'],
    ['fatal', 'sev', 'severe', 'crit', 'critical'],
]

const aliasToCanonical: Record<string, LogLevel> = {}
for (const group of LEVEL_GROUPS) {
    const canonical = group[0] as LogLevel
    for (const alias of group) aliasToCanonical[alias] = canonical
}

// Longest aliases first so e.g. "warning" wins over "warn".
const aliases = Object.keys(aliasToCanonical).sort((a, b) => b.length - a.length)
const joined = aliases.join('|')
const upper = joined.toUpperCase()

const singleLetterToLevel: Record<string, LogLevel> = {
    E: 'error', W: 'warn', I: 'info', D: 'debug', T: 'trace', F: 'fatal', V: 'trace',
}

interface Matcher { re: RegExp; single?: boolean }

// Confidence tiers, highest first — see Dozzle's level_guesser.go for the rationale.
const tiers: Matcher[][] = [
    [{ re: new RegExp(`^(${joined})[^a-z]`, 'gi') }],
    [
        { re: new RegExp(`\\[ ?(${joined}) ?\\]`, 'gi') },
        { re: /\[([EWIDFTV])\]/g, single: true },
    ],
    [{ re: new RegExp(`:(${joined})\\s`, 'gi') }],
    [{ re: new RegExp(`"(${upper})"`, 'g') }],
    [{ re: new RegExp(` (${joined})[/|:-]`, 'gi') }],
    [{ re: new RegExp(`\\s(${upper})\\s`, 'g') }],
]

// eslint-disable-next-line no-control-regex
const ansiRe = /[][[\]()#;?]*(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?|(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PRZcf-ntqry=><~])/g

export function stripAnsi(str: string): string {
    return str.replace(ansiRe, '')
}

const leadingTimestampStripRe = /^(?:\d{4}[-/]\d{2}[-/]\d{2}(?:[T ](?:\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?|\d{2}:\d{2}(?:AM|PM)))?\s+)/

function guessFromString(value: string): LogLevel {
    value = stripAnsi(value).replace(leadingTimestampStripRe, '')
    for (const tier of tiers) {
        let level: LogLevel | '' = ''
        for (const m of tier) {
            for (const match of value.matchAll(m.re)) {
                const canonical = m.single
                    ? singleLetterToLevel[match[1][0]]
                    : aliasToCanonical[match[1].toLowerCase()]
                if (!canonical) continue
                if (level === '') level = canonical
                else if (level !== canonical) return 'unknown' // ambiguous within a tier
            }
        }
        if (level) return level
    }
    return 'unknown'
}

const LEVEL_KEYS = ['@l', 'level', 'lvl', 'log.level', 'severity']
const MESSAGE_KEYS = ['msg', 'message', '@m', '@message']
const TIMESTAMP_KEYS = ['ts', 'time', '@t', '@timestamp', 'timestamp']

function normalizeLevel(level: string): LogLevel {
    const l = stripAnsi(level).toLowerCase()
    return aliasToCanonical[l] ?? (['error', 'warn', 'info', 'debug', 'trace', 'fatal'].includes(l) ? l as LogLevel : 'unknown')
}

// Structure detection

function tryJson(s: string): Record<string, unknown> | null {
    const t = s.trim()
    if (!t.startsWith('{') || !t.endsWith('}')) return null
    try {
        const o = JSON.parse(t)
        return o && typeof o === 'object' && !Array.isArray(o) ? o as Record<string, unknown> : null
    } catch {
        return null
    }
}

const logfmtPairRe = /([\w.@/-]+)=("(?:[^"\\]|\\.)*"|\S*)/g

function tryLogfmt(s: string): { key: string; value: string }[] | null {
    const t = s.trim()
    if (!/^[\w.@/-]+=/.test(t)) return null
    const pairs: { key: string; value: string }[] = []
    let lastEnd = 0
    for (const m of t.matchAll(logfmtPairRe)) {
        // The whole line must be key=value pairs separated only by whitespace.
        if (t.slice(lastEnd, m.index).trim() !== '') return null
        let val = m[2]
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1).replace(/\\"/g, '"')
        pairs.push({ key: m[1], value: val })
        lastEnd = m.index + m[0].length
    }
    if (t.slice(lastEnd).trim() !== '') return null
    return pairs.length > 0 ? pairs : null
}

function valueType(v: unknown): LogField['type'] {
    if (v === null) return 'null'
    if (typeof v === 'number') return 'number'
    if (typeof v === 'boolean') return 'boolean'
    return 'string'
}

function stringifyValue(v: unknown): string {
    if (v === null) return 'null'
    if (typeof v === 'string') return v
    return JSON.stringify(v)
}

// Public API

// Docker prepends an RFC3339Nano timestamp + space to every line when
// timestamps=true. Pull it off before structure detection so a JSON/logfmt
// payload still parses, and surface it as the line timestamp.
const dockerTimestampRe = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\s+([\s\S]*)$/

function parseLine(raw: string, id: number): ParsedLogLine {
    const cleaned = stripAnsi(raw)
    const tsMatch = cleaned.match(dockerTimestampRe)
    const leadingTs = tsMatch ? tsMatch[1] : null
    const clean = tsMatch ? tsMatch[2] : cleaned

    // JSON structured log
    const json = tryJson(clean)
    if (json) {
        let level: LogLevel = 'unknown'
        let message = ''
        let timestamp: string | null = null
        const fields: LogField[] = []
        for (const [key, value] of Object.entries(json)) {
            if (level === 'unknown' && LEVEL_KEYS.includes(key) && typeof value === 'string') {
                level = normalizeLevel(value)
                continue
            }
            if (!message && MESSAGE_KEYS.includes(key) && typeof value === 'string') {
                message = value
                continue
            }
            if (!timestamp && TIMESTAMP_KEYS.includes(key)) {
                timestamp = stringifyValue(value)
                continue
            }
            fields.push({ key, value: stringifyValue(value), type: valueType(value) })
        }
        return { id, level, timestamp: timestamp ?? leadingTs, message, fields, kind: 'json', raw }
    }

    // logfmt structured log
    const logfmt = tryLogfmt(clean)
    if (logfmt) {
        let level: LogLevel = 'unknown'
        let message = ''
        let timestamp: string | null = null
        const fields: LogField[] = []
        for (const { key, value } of logfmt) {
            if (level === 'unknown' && LEVEL_KEYS.includes(key)) { level = normalizeLevel(value); continue }
            if (!message && MESSAGE_KEYS.includes(key)) { message = value; continue }
            if (!timestamp && TIMESTAMP_KEYS.includes(key)) { timestamp = value; continue }
            fields.push({ key, value, type: 'string' })
        }
        if (level === 'unknown') level = guessFromString(clean)
        return { id, level, timestamp: timestamp ?? leadingTs, message, fields, kind: 'logfmt', raw }
    }

    // Plain text — the Docker timestamp (if any) was already split off above.
    return { id, level: guessFromString(clean), timestamp: leadingTs, message: clean, fields: [], kind: 'text', raw }
}

/** Parse a raw multi-line log blob into structured lines. */
export function parseLogs(raw: string): ParsedLogLine[] {
    if (!raw) return []
    const lines = raw.split('\n')
    // Drop a single trailing empty line from the final newline.
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
    return lines.map((line, i) => parseLine(line.replace(/\r$/, ''), i))
}
