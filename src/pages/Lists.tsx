import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Empty, LinkButton, Loading, PageHeader, SearchInput, Tabs } from '../components/ui'
import { useApp, useLoad } from '../lib/app'
import { balance } from '../lib/calc'
import { db } from '../lib/db'
import { QUOTE_STATUS } from '../lib/defaults'
import { isQuoteExpired } from '../lib/docs'
import { date, daysBetween, money, normalizePlate, plate, today } from '../lib/format'
import { vehicleLabel } from '../lib/share'
import type { Customer, Vehicle } from '../lib/types'

export function useRefs() {
  return useLoad(async () => {
    const [customers, vehicles] = await Promise.all([db.list('customers'), db.list('vehicles')])
    return { c: new Map(customers.map((x) => [x.id, x])), v: new Map(vehicles.map((x) => [x.id, x])) }
  })
}

const matches = (q: string, c?: Customer, v?: Vehicle, number?: string) => {
  const t = q.trim().toLowerCase()
  if (!t) return true
  const p = normalizePlate(q)
  return (
    (c?.name.toLowerCase().includes(t) ?? false) ||
    (p.length >= 3 && (v?.plate.includes(p) ?? false)) ||
    `${v?.brand ?? ''} ${v?.model ?? ''}`.toLowerCase().includes(t) ||
    (number?.toLowerCase().includes(t) ?? false)
  )
}

type QF = 'abertos' | 'aprovado' | 'todos' | 'arquivados'

export function QuoteList() {
  const { data: quotes } = useLoad(() => db.list('quotes'))
  const { data: refs } = useRefs()
  const [q, setQ] = useState('')
  const [f, setF] = useState<QF>('abertos')
  const list = useMemo(() => (quotes ?? []).filter((x) => {
    if (f === 'arquivados') return !!x.archived_at
    if (x.archived_at) return false
    if (f === 'abertos' && !['rascunho', 'enviado'].includes(x.status)) return false
    if (f === 'aprovado' && x.status !== 'aprovado') return false
    return matches(q, refs?.c.get(x.customer_id), refs?.v.get(x.vehicle_id), x.number)
  }), [quotes, refs, q, f])

  if (!quotes || !refs) return <Loading />
  return (
    <div>
      <PageHeader title="Orçamentos" actions={<LinkButton to="/orcamentos/novo">+ Novo</LinkButton>} />
      <SearchInput value={q} onChange={setQ} placeholder="Buscar por cliente, placa, modelo ou número" />
      <Tabs value={f} onChange={setF} options={[{ value: 'abertos', label: 'Em aberto' }, { value: 'aprovado', label: 'Aprovados' }, { value: 'todos', label: 'Todos' }, { value: 'arquivados', label: 'Arquivados' }]} />
      {list.length === 0 ? (
        <Empty title={quotes.length ? 'Nada encontrado' : 'Nenhum orçamento ainda'} text={quotes.length ? 'Tente outro filtro.' : 'Crie o primeiro orçamento com fotos e envie pelo WhatsApp.'} action={!quotes.length && <LinkButton to="/orcamentos/novo">Criar orçamento</LinkButton>} />
      ) : (
        <ul className="space-y-2">
          {list.map((x) => {
            const st = QUOTE_STATUS[isQuoteExpired(x) ? 'expirado' : x.status]
            const v = refs.v.get(x.vehicle_id)
            return (
              <li key={x.id}>
                <Link to={`/orcamentos/${x.id}`} className="block rounded-xl border border-slate-200 bg-white p-3 active:bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{refs.c.get(x.customer_id)?.name}</span>
                    <strong>{money(x.total)}</strong>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-sm text-slate-600">
                    <span className="truncate">{plate(v?.plate)} • {vehicleLabel(v)}</span>
                    <Badge className={st.cls}>{st.label}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{x.number} • {date(x.created_at)}{x.insurance ? ` • ${x.insurance.insurer}` : ''}</div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

type OF = 'oficina' | 'prontos' | 'entregues' | 'todos' | 'arquivados'

export function WorkOrderList() {
  const { settings } = useApp()
  const { data } = useLoad(async () => {
    const [orders, payments] = await Promise.all([db.list('work_orders'), db.list('payments')])
    return { orders, payments }
  })
  const { data: refs } = useRefs()
  const [q, setQ] = useState('')
  const [f, setF] = useState<OF>('oficina')
  const list = useMemo(() => (data?.orders ?? []).filter((x) => {
    if (f === 'arquivados') return !!x.archived_at
    if (x.archived_at) return false
    if (f === 'oficina' && (x.stage === 'entregue' || x.stage === 'pronto')) return false
    if (f === 'prontos' && x.stage !== 'pronto') return false
    if (f === 'entregues' && x.stage !== 'entregue') return false
    return matches(q, refs?.c.get(x.customer_id), refs?.v.get(x.vehicle_id), x.number)
  }).sort((a, b) => (a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : 1), [data, refs, q, f])

  if (!data || !refs || !settings) return <Loading />
  return (
    <div>
      <PageHeader title="Ordens de serviço" actions={<LinkButton to="/os/nova">+ Nova</LinkButton>} />
      <SearchInput value={q} onChange={setQ} placeholder="Buscar por cliente, placa, modelo ou número" />
      <Tabs value={f} onChange={setF} options={[{ value: 'oficina', label: 'Na oficina' }, { value: 'prontos', label: 'Prontos' }, { value: 'entregues', label: 'Entregues' }, { value: 'todos', label: 'Todos' }, { value: 'arquivados', label: 'Arquivadas' }]} />
      {list.length === 0 ? (
        <Empty title={data.orders.length ? 'Nada encontrado' : 'Nenhuma OS ainda'} text="Abra uma OS manualmente ou transforme um orçamento aprovado." action={!data.orders.length && <LinkButton to="/os/nova">Abrir OS</LinkButton>} />
      ) : (
        <ul className="space-y-2">{list.map((x) => <WorkOrderCard key={x.id} wo={x} refs={refs} due={balance(x.total, data.payments.filter((p) => p.work_order_id === x.id)).due} />)}</ul>
      )}
    </div>
  )
}

export function WorkOrderCard({ wo, refs, due }: { wo: import('../lib/types').WorkOrder; refs: { c: Map<string, Customer>; v: Map<string, Vehicle> }; due?: number }) {
  const { settings } = useApp()
  const st = settings!.stages.find((s) => s.key === wo.stage)
  const v = refs.v.get(wo.vehicle_id)
  const late = !wo.delivered_at && wo.due_date && wo.due_date < today()
  return (
    <li>
      <Link to={`/os/${wo.id}`} className={`block rounded-xl border bg-white p-3 active:bg-slate-50 ${late ? 'border-red-300' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">{plate(v?.plate)} • {vehicleLabel(v)}</span>
          <Badge style={{ background: st?.color, color: '#fff' }}>{st?.name ?? wo.stage}</Badge>
        </div>
        <div className="mt-1 flex justify-between text-sm text-slate-600">
          <span className="truncate">{refs.c.get(wo.customer_id)?.name}</span>
          {due !== undefined && due > 0 && <span className="text-amber-800">Saldo {money(due)}</span>}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {wo.number} • {wo.delivered_at ? `entregue ${date(wo.delivered_at)}` : `${daysBetween(wo.entry_date)} dia(s) na oficina`}
          {wo.due_date && !wo.delivered_at && <span className={late ? 'font-bold text-red-700' : ''}> • previsão {date(wo.due_date)}{late ? ' (atrasada)' : ''}</span>}
        </div>
      </Link>
    </li>
  )
}

export function Production() {
  const { settings } = useApp()
  const { data } = useLoad(() => db.list('work_orders', { archived_at: null }))
  const { data: refs } = useRefs()
  if (!data || !refs || !settings) return <Loading />
  const active = data.filter((w) => w.stage !== 'entregue')
  return (
    <div>
      <PageHeader title="Produção" />
      {active.length === 0 && <Empty title="Nenhum veículo na oficina" />}
      <div className="space-y-4 lg:flex lg:gap-3 lg:space-y-0 lg:overflow-x-auto lg:pb-4">
        {settings.stages.filter((s) => s.key !== 'entregue').map((s) => {
          const items = active.filter((w) => w.stage === s.key)
          if (!items.length) return null
          return (
            <section key={s.key} className="lg:w-72 lg:shrink-0">
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase text-slate-700">
                <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
                {s.name} <span className="text-slate-400">{items.length}</span>
              </h2>
              <ul className="space-y-2">{items.map((w) => <WorkOrderCard key={w.id} wo={w} refs={refs} />)}</ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
