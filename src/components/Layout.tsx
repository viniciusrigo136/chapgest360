import { BarChart3, ClipboardList, FilePlus2, FileText, Home, Plus, Settings, UserPlus, Users, Wrench, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../lib/app'
import { db } from '../lib/db'
import { ThemeToggle } from './ThemeToggle'
import { Logo } from './Logo'
import { Sheet } from './ui'

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/orcamentos', label: 'Orçamentos', icon: FileText },
  { to: '/os', label: 'Serviços', icon: Wrench },
  { to: '/clientes', label: 'Clientes', icon: Users },
]

export function Layout() {
  const nav = useNavigate()
  const { settings } = useApp()
  const [newOpen, setNewOpen] = useState(false)
  // Nos editores a barra inferior dá lugar ao botão Salvar.
  const editing = /\/(novo|nova|editar)$/.test(useLocation().pathname)
  return (
    <div className="min-h-dvh">
      {db.mode === 'local' && (
        <div className="app-chrome bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900 lg:pl-64">
          {import.meta.env.VITE_DEMO ? 'Demonstração com dados de exemplo — salvos só neste navegador' : 'Modo local de teste — dados salvos só neste aparelho'}
        </div>
      )}

      <aside className="app-chrome fixed inset-y-0 left-0 hidden w-64 flex-col bg-card p-3 ring-1 ring-slate-200 lg:flex">
        <Link to="/" className="mb-5 px-2 py-2">
          <Logo subtitle={settings?.trade_name} />
        </Link>
        <button type="button" onClick={() => setNewOpen(true)} className="mb-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-600 font-bold text-white">
          <Plus size={20} /> Novo
        </button>
        {[...NAV.slice(0, 3), { to: '/indicadores', label: 'Indicadores', icon: BarChart3 }, NAV[3], { to: '/config', label: 'Configurações', icon: Settings }].map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `mb-1 flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <n.icon size={20} />
            {n.label}
          </NavLink>
        ))}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 px-1 pt-3">
          <span className="text-xs text-slate-500">Aparência</span>
          <ThemeToggle withLabel />
        </div>
      </aside>

      <main className="mx-auto max-w-xl px-4 pb-28 pt-4 sm:max-w-2xl lg:ml-64 lg:max-w-none lg:px-8 lg:pb-10 lg:pt-6 xl:px-12">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      <nav hidden={editing} className="app-chrome fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5">
          {NAV.slice(0, 2).map((n) => <Tab key={n.to} {...n} />)}
          <button type="button" onClick={() => setNewOpen(true)} className="flex items-center justify-center" aria-label="Novo">
            <span className="-mt-6 flex h-15 w-15 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-md ring-4 ring-card">
              <Plus size={30} strokeWidth={2.5} />
            </span>
          </button>
          {NAV.slice(2).map((n) => <Tab key={n.to} {...n} />)}
        </div>
      </nav>

      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title="O que você quer fazer?">
        {[
          { to: '/orcamentos/novo', label: 'Novo orçamento', text: 'Fotos, serviços e valor para mandar ao cliente', icon: FilePlus2 },
          { to: '/os/nova', label: 'Receber um carro', text: 'Abrir ordem de serviço direto, sem orçamento', icon: ClipboardList },
          { to: '/clientes?novo=1', label: 'Novo cliente', text: 'Cadastrar cliente e veículo', icon: UserPlus },
        ].map((o) => (
          <button key={o.to} type="button" onClick={() => { setNewOpen(false); nav(o.to) }} className="flex w-full items-center gap-4 rounded-2xl p-3 text-left ring-1 ring-slate-200 active:bg-slate-50">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><o.icon size={24} /></span>
            <span>
              <span className="block font-bold">{o.label}</span>
              <span className="block text-sm text-slate-500">{o.text}</span>
            </span>
          </button>
        ))}
      </Sheet>
    </div>
  )
}

function Tab({ to, label, icon: Icon, end }: { to: string; label: string; icon: LucideIcon; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${isActive ? 'text-brand-600' : 'text-slate-500'}`}>
      {({ isActive }) => (
        <>
          <Icon size={23} strokeWidth={isActive ? 2.4 : 2} />
          {label}
        </>
      )}
    </NavLink>
  )
}
