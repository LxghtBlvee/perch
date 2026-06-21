import { ref, watch } from 'vue'

// Per-user display preferences, persisted in localStorage. Module-level refs so
// every component shares one reactive source.

const TZ_KEY = 'perch_pref_timezone'
const TF_KEY = 'perch_pref_timeformat'
const TOASTS_KEY = 'perch_pref_toasts'

export type TimeFormat = 'system' | '12' | '24'

// '' = follow the browser's local timezone
const timezone = ref(localStorage.getItem(TZ_KEY) ?? '')
const timeFormat = ref<TimeFormat>((localStorage.getItem(TF_KEY) as TimeFormat | null) ?? 'system')
const toastsEnabled = ref(localStorage.getItem(TOASTS_KEY) !== '0')

watch(timezone, v => localStorage.setItem(TZ_KEY, v))
watch(timeFormat, v => localStorage.setItem(TF_KEY, v))
watch(toastsEnabled, v => localStorage.setItem(TOASTS_KEY, v ? '1' : '0'))

/** The list of IANA timezones the browser knows, when available. */
export function supportedTimezones(): string[] {
    try {
        // Intl.supportedValuesOf is widely available in modern browsers.
        const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf
        return fn ? fn('timeZone') : []
    } catch {
        return []
    }
}

/**
 * Format a date/time using the user's timezone + time-format preference.
 * Reads the module-level refs so callers in templates re-render when prefs change.
 */
export function formatDateTime(input: string | number | Date): string {
    const d = input instanceof Date ? input : new Date(input)
    if (isNaN(d.getTime())) return String(input)
    const hour12 = timeFormat.value === '12' ? true : timeFormat.value === '24' ? false : undefined
    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: timezone.value || undefined,
            hour12,
        }).format(d)
    } catch {
        return d.toLocaleString()
    }
}

export function useUserPrefs() {
    return { timezone, timeFormat, toastsEnabled }
}
