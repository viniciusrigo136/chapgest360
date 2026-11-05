import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from './backend'
import { db } from './db'
import { upgradeStages } from './defaults'
import type { Settings } from './types'

interface AppState {
  session: Session | null
  settings: Settings | null
  loading: boolean
  /** Muda a cada gravação; listas recarregam quando muda. */
  version: number
  refresh: () => void
  reloadSession: () => Promise<void>
  saveSettings: (s: Settings) => Promise<void>
  toast: (msg: string, kind?: 'ok' | 'erro') => void
}

const Ctx = createContext<AppState>(null!)
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState(0)
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: 'ok' | 'erro' }[]>([])

  const reloadSession = useCallback(async () => {
    setLoading(true)
    try {
      const s = await db.getSession()
      if (import.meta.env.VITE_DEMO && s?.organizationId) await (await import('./demoSeed')).seedDemo(s.organizationId)
      setSession(s)
      const st = s?.organizationId ? await db.getSettings() : null
      setSettings(st ? { ...st, stages: upgradeStages(st.stages), brand_color: st.brand_color === '#1d4ed8' ? '#2563eb' : st.brand_color } : null)
    } catch {
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reloadSession()
  }, [reloadSession])

  const toast = useCallback((msg: string, kind: 'ok' | 'erro' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'erro' ? 6000 : 3000)
  }, [])

  const saveSettings = useCallback(async (s: Settings) => {
    await db.saveSettings(s)
    setSettings(s)
  }, [])

  return (
    <Ctx.Provider value={{ session, settings, loading, version, refresh: () => setVersion((v) => v + 1), reloadSession, saveSettings, toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 lg:bottom-6 print:hidden" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`max-w-md rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${t.kind === 'ok' ? 'bg-[#047857]' : 'bg-[#dc2626]'}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

/** Carrega dados assíncronos e recarrega quando `deps` ou a versão global mudam. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const { version } = useApp()
  const [data, setData] = useState<T | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    fn()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, tick, ...deps])
  return { data, error, reload: () => setTick((t) => t + 1) }
}

/** Executa uma ação com feedback (toast) e trava contra clique duplo. */
export function useAction() {
  const { toast, refresh } = useApp()
  const [busy, setBusy] = useState(false)
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, okMsg?: string): Promise<T | undefined> => {
      if (busy) return
      setBusy(true)
      try {
        const r = await fn()
        if (okMsg) toast(okMsg)
        refresh()
        return r
      } catch (e) {
        toast((e as Error).message || 'Erro inesperado', 'erro')
      } finally {
        setBusy(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busy, toast],
  )
  return { busy, run }
}
