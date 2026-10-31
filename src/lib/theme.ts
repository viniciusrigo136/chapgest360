import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'lataria-theme'

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

/** Tema escolhido pelo usuário; sem escolha, segue o celular/computador. */
export function currentTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme')
  return stored() ?? (attr === 'dark' || attr === 'light' ? attr : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

export function applyTheme(t: Theme = currentTheme()) {
  document.documentElement.classList.toggle('dark', t === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0b1120' : '#1f47c7')
}

export function useTheme() {
  const [theme, set] = useState<Theme>(currentTheme)
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const f = () => {
      if (!stored()) {
        set(currentTheme())
        applyTheme()
      }
    }
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
    applyTheme(next)
    set(next)
  }
  return { theme, toggle }
}
