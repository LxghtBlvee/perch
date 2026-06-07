import { ref } from 'vue'

export type ColorMode = 'light' | 'dark' | 'system'
const KEY = 'perch_color_mode'

const mode = ref<ColorMode>((localStorage.getItem(KEY) as ColorMode) ?? 'system')
const mq = window.matchMedia('(prefers-color-scheme: dark)')


function apply(m: ColorMode) {
    const dark = m === 'dark' || (m === 'system' && mq.matches)
    document.documentElement.classList.toggle('dark', dark)
}

mq.addEventListener('change', () => { if (mode.value === 'system') apply('system') })

apply(mode.value)

export function useColorMode() {
    function setMode(m: ColorMode) {
        mode.value = m;
        localStorage.setItem(KEY, m);
        apply(m);
    }

    return { mode, setMode };
}