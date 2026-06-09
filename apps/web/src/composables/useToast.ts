import { ref } from 'vue'

export type ToastLevel = 'success' | 'error' | 'warning' | 'info' | 'loading'

export interface Toast {
    id: string;
    level: ToastLevel;
    message: string;
    duration: number // ms; 0 = persist until dismissed
};

const toasts = ref<Toast[]>([])
let counter = 0

function add(level: ToastLevel, message: string, duration: number): string {
    const id = `t${++counter}`
    toasts.value.push({ id, level, message, duration })
    if (duration > 0) {
        setTimeout(() => remove(id), duration)
    }
    return id
}

function remove(id: string) {
    const i = toasts.value.findIndex(t => t.id === id)
    if (i !== -1) toasts.value.splice(i, 1)
}

function update(id: string, level: ToastLevel, message: string, duration = 4000) {
    const toast = toasts.value.find(t => t.id === id)
    if (toast) {
        toast.level = level
        toast.message = message
        toast.duration = duration
  }
}

export function useToast() {
    return {
        toasts,
        success: (message: string, duration = 4000) => add('success', message, duration),
        error: (message: string, duration = 6000) => add('error', message, duration),
        warning: (message: string, duration = 5000) => add('warning', message, duration),
        info: (message: string, duration = 4000) => add('info', message, duration),
        loading: (message: string) => add('loading', message, 0),
        remove,
        update,
    }
}