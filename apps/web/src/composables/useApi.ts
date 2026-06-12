import { useAuthStore } from '@/stores/auth'
import { useCache } from '@/composables/useCache'

export function useApi() {
    const auth = useAuthStore()
    const { get, set } = useCache()

    function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
        const headers = new Headers(options.headers as HeadersInit | undefined)
        if (auth.token) headers.set('Authorization', `Bearer ${auth.token}`)
        return fetch(url, { ...options, headers })
    }

    async function cachedFetch<T>(url: string, ttl = 30_000): Promise<T> {
        const cached = get<T>(url)
        if (cached !== null) return cached
        const res = await apiFetch(url)
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        const data = await res.json() as T
        set(url, data, ttl)
        return data
    }

    return { apiFetch, cachedFetch }
}
