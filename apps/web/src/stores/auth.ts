import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthUser } from '@perch/types'

const TOKEN_KEY = 'perch_token'

export const useAuthStore = defineStore('auth', () => {
    const user = ref<AuthUser | null>(null);
    const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
    const loading = ref(false);

    const isAuthenticated = computed(() => !!user.value);
    const isAdmin = computed(() => user.value?.role === 'admin');

    function setToken(t: string) {
        token.value = t
        localStorage.setItem(TOKEN_KEY, t)
    }

    function clearAuth() {
        user.value = null
        token.value = null
        localStorage.removeItem(TOKEN_KEY)
    }

    async function fetchMe(): Promise<boolean> {
        if (!token.value) return false
        try {
            const res = await fetch('/api/auth/me', {
                headers: { Authorization: `Bearer ${token.value}` },
            })
            if (!res.ok) {
                clearAuth()
                return false
            }
            user.value = await res.json()
            return true
        } catch {
            clearAuth()
            return false
        }
    }

    async function login(email: string, password: string): Promise<void> {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        })
        if (!res.ok) {
            const data = await res.json() as { error?: string }
            throw new Error(data.error ?? 'Login failed')
        }
        const data = await res.json() as { token: string; user: AuthUser }
        setToken(data.token)
        user.value = data.user
    }

    async function logout(): Promise<void> {
        if (token.value) {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token.value}` },
            }).catch(() => {})
        }
        clearAuth()
    }

    function updateUser(updated: AuthUser) {
        user.value = updated
    }

    return { user, token, loading, isAuthenticated, isAdmin, setToken, clearAuth, fetchMe, login, logout, updateUser }
})
