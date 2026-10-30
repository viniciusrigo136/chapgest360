import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { db } from '../lib/db'
import { useState } from 'react'
import { Sheet } from './ui'

const NAV = [
  { to: '/', label: 'Início', icon: '⌂', end: true },
  { to: '/orcamentos', label: 'Orçamentos', icon: '📝' },
  { to: '/os', label: 'OS', icon: '🔧' },
  { to: '/mais', label: 'Mais', icon: '☰' },
]
const SIDE = [...NAV.slice(0, 3), { to: '/producao', label: 'Produção', icon: '▦' }, { to: '/clientes', label: 'Clientes', icon: '👤' }, { to: '/catalogo', label: 'Catálogo', icon: '📋' }, { to: '/config', label: 'Configurações', icon: '⚙' }]

export function Layout() {
  const nav = useNavigate()
  const [newOpen, setNewOpen] = useState(false)
  // Nos editores a barra inferior dá lugar ao botão Salvar.
  const editing = /\/(novo|nova|editar)$/.test(useLocation().pathname)
  return (
    <div className="app-chrome-wrap min-h-dvh">
      {db.mode === 'local' && (
        <div className="app-chrome bg-amber-100 px-4 py-1 text-center text-xs text-amber-900 lg:pl-64">Modo local de teste — dados salvos só neste aparelho</div>
      )}
      <aside className="app-chrome fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white p-3 lg:flex">
        <div className="mb-4 px-3 py-2 text-2xl font-extrabold text-blue-800">Lataria</div>
        {SIDE.map((n) => (
          <NavLink key={n.to} to={n.to} end={'end' in n} className={({ isActive }) => `mb-1 flex min-h-11 items-center gap-3 rounded-lg px-3 font-medium ${isActive ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-100'}`}>
            <span className="w-5 text-center">{n.icon}</span>{n.label}
          </NavLink>
        ))}
      </aside>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-4 lg:ml-60 lg:max-w-none lg:px-8 lg:pb-8">
        <div className="lg:max-w-4xl">
          <Outlet />
        </div>
      </main>

      <nav hidden={editing} className="app-chrome fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.slice(0, 2).map((n) => <Tab key={n.to} {...n} />)}
        <button type="button" onClick={() => setNewOpen(true)} className="flex flex-col items-center justify-center" aria-label="Novo">
          <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-3xl text-white shadow-lg">+</span>
        </button>
        {NAV.slice(2).map((n) => <Tab key={n.to} {...n} />)}
      </nav>

      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title="Criar">
        {[
          ['/orcamentos/novo', 'Novo orçamento'],
          ['/os/nova', 'Nova ordem de serviço'],
          ['/clientes', 'Novo cliente'],
        ].map(([to, label]) => (
          <button key={to} type="button" onClick={() => { setNewOpen(false); nav(to) }} className="flex min-h-14 w-full items-center rounded-xl border border-slate-200 px-4 text-left text-base font-semibold active:bg-slate-50">
            {label}
          </button>
        ))}
      </Sheet>
    </div>
  )
}

function Tab({ to, label, icon, end }: { to: string; label: string; icon: string; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium ${isActive ? 'text-blue-700' : 'text-slate-500'}`}>
      <span className="text-xl leading-none">{icon}</span>
      {label}
    </NavLink>
  )
}
