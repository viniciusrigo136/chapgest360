import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { moneyInput, parseMoney } from '../lib/format'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
const variants: Record<Variant, string> = {
  primary: 'bg-blue-700 text-white active:bg-blue-800 disabled:bg-blue-300',
  secondary: 'bg-white text-slate-800 border border-slate-300 active:bg-slate-100 disabled:text-slate-400',
  danger: 'bg-white text-red-700 border border-red-300 active:bg-red-50',
  ghost: 'text-blue-700 active:bg-blue-50',
  success: 'bg-green-700 text-white active:bg-green-800 disabled:bg-green-300',
}

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...p}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-[15px] font-semibold ${variants[variant]} ${className}`}
    />
  )
}

export function LinkButton({ to, variant = 'primary', className = '', children }: { to: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link to={to} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-[15px] font-semibold ${variants[variant]} ${className}`}>
      {children}
    </Link>
  )
}

export function Field({ label, hint, error, children, className = '' }: { label: string; hint?: string; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
        {children}
      </label>
      {error ? <span className="mt-1 block text-sm text-red-700">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </div>
  )
}

const inputCls = 'block w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100'

export function Input({ className = '', ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={`${inputCls} ${className}`} />
}

export function TextArea({ className = '', ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...p} className={`${inputCls} py-2 ${className}`} />
}

export function Select({ className = '', children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={`${inputCls} ${className}`}>
      {children}
    </select>
  )
}

/** Campo de dinheiro: digita "1.234,56", guarda centavos. */
export function MoneyInput({ value, onChange, ...p }: { value: number; onChange: (c: number) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [text, setText] = useState(value ? moneyInput(value) : '')
  useEffect(() => {
    if (parseMoney(text) !== value) setText(value ? moneyInput(value) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <div className="relative">
      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">R$</span>
      <Input
        inputMode="decimal"
        placeholder="0,00"
        {...p}
        className="pl-10 text-right"
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
  return <div className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>{children}</div>
}

export function Section({ title, children, right, className = '' }: { title: string; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      <div className="flex min-h-12 items-center justify-between gap-2 border-b border-slate-100 px-4 py-2">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {right}
      </div>
      <div className="space-y-3 p-4">{children}</div>
    </section>
  )
}

/** Seção opcional: aparece só quando ativada. */
export function OptionalSection({ title, enabled, onEnable, onDisable, addLabel, children }: {
  title: string; enabled: boolean; onEnable: () => void; onDisable: () => void; addLabel: string; children: ReactNode
}) {
  if (!enabled)
    return (
      <button type="button" onClick={onEnable} className="flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-4 text-[15px] font-semibold text-slate-600 active:bg-slate-100">
        + {addLabel}
      </button>
    )
  return (
    <Section title={title} right={<button type="button" className="text-sm font-medium text-red-700" onClick={() => confirm(`Remover "${title}" deste documento?`) && onDisable()}>Remover</button>}>
      {children}
    </Section>
  )
}

export function PageHeader({ title, back, actions }: { title: string; back?: string; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      {back && (
        <Link to={back} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-2xl text-slate-600 active:bg-slate-200" aria-label="Voltar">
          ‹
        </Link>
      )}
      <h1 className="flex-1 truncate text-xl font-bold text-slate-900">{title}</h1>
      {actions}
    </div>
  )
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="font-semibold text-slate-800">{title}</p>
      {text && <p className="mt-1 text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Badge({ children, className = 'bg-slate-200 text-slate-800', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <span style={style} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{children}</span>
}

export function Loading() {
  return <div className="py-16 text-center text-slate-500">Carregando…</div>
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{message}</div>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center print:hidden" onClick={onClose}>
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white sm:max-w-lg sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl text-slate-500 active:bg-slate-100" aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`min-h-9 shrink-0 rounded-full px-3 text-sm font-semibold ${value === o.value ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-300'}`}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1 opacity-70">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mb-3" />
}
