import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../lib/theme'

/** Botão sol/lua para alternar entre modo claro e escuro. */
export function ThemeToggle({ withLabel = false, className = '' }: { withLabel?: boolean; className?: string }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  const label = dark ? 'Modo claro' : 'Modo escuro'
  return (
    <button type="button" onClick={toggle} aria-label={label} title={label}
      className={`flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-card text-slate-600 ring-1 ring-slate-200 active:bg-slate-50 ${withLabel ? 'px-3 font-semibold' : 'w-11'} ${className}`}>
      {dark ? <Sun size={20} /> : <Moon size={20} />}
      {withLabel && label}
    </button>
  )
}
