import { ChevronDown, ChevronLeft, Plus, X, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { askConfirm } from '../lib/confirm'
import { moneyInput, normalizePlate, parseMoney } from '../lib/format'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'whatsapp'
const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm shadow-brand-600/25 active:bg-brand-700 disabled:bg-brand-300 disabled:shadow-none',
  secondary: 'bg-white text-ink ring-1 ring-slate-200 active:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-white text-red-700 ring-1 ring-red-200 active:bg-red-50',
  ghost: 'text-brand-700 active:bg-brand-50',
  success: 'bg-emerald-600 text-white active:bg-emerald-700 disabled:bg-emerald-300',
  whatsapp: 'bg-wa text-white shadow-sm shadow-wa/30 active:bg-wa-dark',
}
const btnBase = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed'

export function Button({ variant = 'primary', icon: Icon, className = '', children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: LucideIcon }) {
  return (
    <button type="button" {...p} className={`${btnBase} ${variants[variant]} ${className}`}>
      {Icon && <Icon size={19} strokeWidth={2.2} aria-hidden />}
      {children}
    </button>
  )
}

export function LinkButton({ to, variant = 'primary', icon: Icon, className = '', children }: { to: string; variant?: Variant; icon?: LucideIcon; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={`${btnBase} ${variants[variant]} ${className}`}>
      {Icon && <Icon size={19} strokeWidth={2.2} aria-hidden />}
      {children}
    </Link>
  )
}

/** Botão grande de ação, com ícone e texto curto embaixo (usado no início e nas telas de documento). */
export function ActionTile({ icon: Icon, label, to, onClick, tone = 'white' }: { icon: LucideIcon; label: string; to?: string; onClick?: () => void; tone?: 'brand' | 'white' | 'whatsapp' }) {
  const cls = {
    brand: 'bg-brand-600 text-white shadow-md shadow-brand-600/25',
    whatsapp: 'bg-wa text-white shadow-md shadow-wa/25',
    white: 'bg-white text-ink ring-1 ring-slate-200',
  }[tone]
  const inner = (
    <>
      <Icon size={26} strokeWidth={2} aria-hidden />
      <span className="text-[15px] font-bold leading-tight">{label}</span>
    </>
  )
  const base = `flex min-h-24 flex-col items-start justify-between gap-3 rounded-2xl p-4 text-left active:scale-[0.98] transition-transform ${cls}`
  return to ? <Link to={to} className={base}>{inner}</Link> : <button type="button" onClick={onClick} className={base}>{inner}</button>
}

export function Field({ label, hint, error, children, className = '' }: { label: string; hint?: string; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-semibold text-slate-600">{label}</span>
        {children}
      </label>
      {error ? <span className="mt-1 block text-sm text-red-700">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </div>
  )
}

const inputCls = 'block w-full min-h-12 rounded-xl border-0 bg-white px-3.5 text-base text-ink ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-100'

export function Input({ className = '', ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={`${inputCls} ${className}`} />
}

export function TextArea({ className = '', ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...p} className={`${inputCls} py-3 ${className}`} />
}

export function Select({ className = '', children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={`${inputCls} ${className}`}>
      {children}
    </select>
  )
}

/** Campo de dinheiro: digita "1.234,56", guarda centavos. */
export function MoneyInput({ value, onChange, className = '', ...p }: { value: number; onChange: (c: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(value ? moneyInput(value) : '')
  useEffect(() => {
    if (parseMoney(text) !== value) setText(value ? moneyInput(value) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <div className={`relative ${className}`}>
      <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">R$</span>
      <Input
        inputMode="decimal"
        placeholder="0,00"
        {...p}
        className="tnum pl-10 text-right font-semibold"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onChange(parseMoney(e.target.value))
        }}
        onBlur={() => setText(value ? moneyInput(value) : '')}
      />
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(19,32,58,0.06)] ring-1 ring-slate-200/70 ${className}`}>{children}</div>
}

export function Section({ title, icon: Icon, children, right, className = '' }: { title: string; icon?: LucideIcon; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white shadow-[0_1px_2px_rgba(19,32,58,0.06)] ring-1 ring-slate-200/70 ${className}`}>
      <div className="flex min-h-13 items-center justify-between gap-2 px-4 pt-3">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink">
          {Icon && <Icon size={18} className="text-brand-600" aria-hidden />}
          {title}
        </h2>
        {right}
      </div>
      <div className="space-y-3 p-4 pt-3">{children}</div>
    </section>
  )
}

/** Bloco que abre e fecha. Usado para esconder o que não é do dia a dia. */
export function Collapsible({ title, icon: Icon, subtitle, children, defaultOpen = false }: { title: string; icon?: LucideIcon; subtitle?: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group rounded-2xl bg-white shadow-[0_1px_2px_rgba(19,32,58,0.06)] ring-1 ring-slate-200/70">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4">
        {Icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon size={18} aria-hidden /></span>}
        <span className="flex-1">
          <span className="block text-[15px] font-bold">{title}</span>
          {subtitle && <span className="block text-xs text-slate-500">{subtitle}</span>}
        </span>
        <ChevronDown size={20} className="text-slate-400 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-3 border-t border-slate-100 p-4">{children}</div>
    </details>
  )
}

/** Seção opcional: aparece só quando ativada. */
export function OptionalSection({ title, enabled, onEnable, onDisable, addLabel, children }: {
  title: string; enabled: boolean; onEnable: () => void; onDisable: () => void; addLabel: string; children: ReactNode
}) {
  if (!enabled)
    return (
      <button type="button" onClick={onEnable} className="flex min-h-12 w-full items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 text-[15px] font-semibold text-slate-600 active:bg-slate-100">
        <Plus size={18} aria-hidden /> {addLabel}
      </button>
    )
  return (
    <div className="space-y-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">{title}</span>
        <button type="button" className="text-sm font-semibold text-red-700" onClick={async () => (await askConfirm(`Remover "${title}" deste documento?`, 'Remover')) && onDisable()}>Remover</button>
      </div>
      {children}
    </div>
  )
}

export function PageHeader({ title, subtitle, back, actions }: { title: ReactNode; subtitle?: ReactNode; back?: string | true; actions?: ReactNode }) {
  const nav = useNavigate()
  return (
    <div className="mb-4 flex items-center gap-2">
      {back && (
        <button type="button" onClick={() => (back === true ? nav(-1) : nav(back))} className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 active:bg-slate-200" aria-label="Voltar">
          <ChevronLeft size={26} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-extrabold tracking-tight text-ink">{title}</h1>
        {subtitle && <div className="truncate text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions}
    </div>
  )
}

export function Empty({ icon: Icon, title, text, action }: { icon?: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-10 text-center">
      {Icon && <Icon size={36} className="mx-auto mb-3 text-slate-300" aria-hidden />}
      <p className="font-bold text-ink">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Badge({ children, className = 'bg-slate-100 text-slate-700', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <span style={style} className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${className}`}>{children}</span>
}

/** Etapa/situação com bolinha colorida. */
export function StatusPill({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: `${color}1a`, color }}>
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {children}
    </span>
  )
}

/** Placa no estilo Mercosul. */
export function Plate({ value, size = 'md' }: { value?: string; size?: 'sm' | 'md' | 'lg' }) {
  const p = normalizePlate(value ?? '')
  const text = /^[A-Z]{3}\d{4}$/.test(p) ? `${p.slice(0, 3)}-${p.slice(3)}` : p
  const s = { sm: 'text-[15px] min-w-[74px]', md: 'text-lg min-w-[88px]', lg: 'text-2xl min-w-[118px]' }[size]
  return (
    <span className={`inline-flex shrink-0 flex-col overflow-hidden rounded-md bg-white text-center ring-[1.5px] ring-slate-800 ${s}`}>
      <span className="h-[5px] bg-[#1f3fa0]" />
      <span className="px-1.5 font-plate font-bold leading-[1.15] tracking-[0.06em] text-slate-900">{text || '—'}</span>
    </span>
  )
}

export function Loading() {
  return (
    <div className="space-y-3 py-4" aria-label="Carregando">
      {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200/70" />)}
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-xl bg-red-50 p-4 text-sm font-medium text-red-800 ring-1 ring-red-200">{message}</div>
}

/** Painel que sobe de baixo no celular e vira modal no desktop. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center print:hidden" onClick={onClose}>
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white sm:max-w-lg sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white px-4 pb-2 pt-2">
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold">{title}</h2>
            <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 active:bg-slate-200" aria-label="Fechar">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="space-y-3 p-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors ${value === o.value ? 'bg-ink text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
        >
          {o.label}
          {o.count !== undefined && o.count > 0 && <span className={`ml-1.5 rounded-full px-1.5 text-xs ${value === o.value ? 'bg-white/20' : 'bg-slate-100'}`}>{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mb-3" />
}

/** Linha de lista tocável (cliente, veículo, documento). */
export function RowLink({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={`block rounded-2xl bg-white p-3.5 shadow-[0_1px_2px_rgba(19,32,58,0.06)] ring-1 ring-slate-200/70 active:bg-slate-50 ${className}`}>
      {children}
    </Link>
  )
}
