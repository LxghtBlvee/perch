import { useAuthStore } from '@/stores/auth'

export function useApi() {
    const auth = useAuthStore()

    function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
        const headers = new Headers(options.headers as HeadersInit | undefined)
        if (auth.token) headers.set('Authorization', `Bearer ${auth.token}`)
        return fetch(url, { ...options, headers })
    }

    return { apiFetch }
}
