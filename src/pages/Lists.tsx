import { FilePlus2, FileText, Plus, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Empty, LinkButton, Loading, PageHeader, Plate, RowLink, SearchInput, StatusPill, Tabs } from '../components/ui'
import { useApp, useLoad } from '../lib/app'
import { balance } from '../lib/calc'
import { db } from '../lib/db'
import { QUOTE_STATUS } from '../lib/defaults'
import { isQuoteExpired } from '../lib/docs'
import { date, daysBetween, money, normalizePlate, today } from '../lib/format'
import { vehicleLabel } from '../lib/share'
import type { Customer, Vehicle, WorkOrder } from '../lib/types'

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
  const live = (quotes ?? []).filter((x) => !x.archived_at)
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
      <PageHeader title="Orçamentos" actions={<LinkButton to="/orcamentos/novo" icon={Plus} className="min-h-11">Novo</LinkButton>} />
      <SearchInput value={q} onChange={setQ} placeholder="Buscar nome, placa ou carro" />
      <Tabs value={f} onChange={setF} options={[
        { value: 'abertos', label: 'Esperando', count: live.filter((x) => ['rascunho', 'enviado'].includes(x.status)).length },
        { value: 'aprovado', label: 'Aprovados' },
        { value: 'todos', label: 'Todos' },
        { value: 'arquivados', label: 'Arquivados' },
      ]} />
      {list.length === 0 ? (
        <Empty icon={FileText} title={quotes.length ? 'Nada por aqui' : 'Nenhum orçamento ainda'} text={quotes.length ? 'Tente outro filtro ou busca.' : 'Faça o primeiro: tire as fotos, coloque os serviços e mande no WhatsApp.'}
          action={!quotes.length && <LinkButton to="/orcamentos/novo" icon={FilePlus2}>Fazer orçamento</LinkButton>} />
      ) : (
        <ul className="space-y-2">
          {list.map((x) => {
            const st = QUOTE_STATUS[isQuoteExpired(x) ? 'expirado' : x.status]
            const v = refs.v.get(x.vehicle_id)
            return (
              <li key={x.id}>
                <RowLink to={`/orcamentos/${x.id}`}>
                  <div className="flex items-center gap-3">
                    <Plate value={v?.plate} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{refs.c.get(x.customer_id)?.name}</div>
                      <div className="truncate text-xs text-slate-500">{vehicleLabel(v)} • {date(x.created_at)}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <strong className="tnum">{money(x.total)}</strong>
                      <Badge className={st.cls}>{st.label}</Badge>
                    </div>
                  </div>
                </RowLink>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function WorkOrderList() {
  const { settings } = useApp()
  const { data } = useLoad(async () => {
    const [orders, payments] = await Promise.all([db.list('work_orders'), db.list('payments')])
    return { orders, payments }
  })
  const { data: refs } = useRefs()
  const [q, setQ] = useState('')
  const [f, setF] = useState<string>('oficina')
  const live = (data?.orders ?? []).filter((x) => !x.archived_at)
  const list = useMemo(() => live.filter((x) => {
    if (f === 'oficina' && x.stage === 'entregue') return false
    if (f === 'entregue' && x.stage !== 'entregue') return false
    if (!['oficina', 'entregue', 'todos'].includes(f) && x.stage !== f) return false
    return matches(q, refs?.c.get(x.customer_id), refs?.v.get(x.vehicle_id), x.number)
  }).sort((a, b) => ((a.due_date ?? '9') < (b.due_date ?? '9') ? -1 : 1)), [live, refs, q, f])

  if (!data || !refs || !settings) return <Loading />
  // Filtro por etapa só mostra etapas que têm carro agora.
  const stageTabs = settings.stages.filter((s) => s.key !== 'entregue' && live.some((x) => x.stage === s.key)).map((s) => ({ value: s.key, label: s.name, count: live.filter((x) => x.stage === s.key).length }))
  return (
    <div>
      <PageHeader title="Serviços" subtitle="Carros na oficina e entregues" actions={<LinkButton to="/os/nova" icon={Plus} className="min-h-11">Receber</LinkButton>} />
      <SearchInput value={q} onChange={setQ} placeholder="Buscar nome, placa ou carro" />
      <Tabs value={f} onChange={setF} options={[
        { value: 'oficina', label: 'Na oficina', count: live.filter((x) => x.stage !== 'entregue').length },
        ...stageTabs,
        { value: 'entregue', label: 'Entregues' },
        { value: 'todos', label: 'Todos' },
      ]} />
      {list.length === 0 ? (
        <Empty icon={Wrench} title={data.orders.length ? 'Nada por aqui' : 'Nenhum serviço ainda'} text="Abra um serviço a partir de um orçamento aprovado ou receba um carro direto."
          action={!data.orders.length && <LinkButton to="/os/nova" icon={Plus}>Receber um carro</LinkButton>} />
      ) : (
        <ul className="space-y-2">{list.map((x) => <WorkOrderCard key={x.id} wo={x} refs={refs} due={balance(x.total, data.payments.filter((p) => p.work_order_id === x.id)).due} />)}</ul>
      )}
    </div>
  )
}

export function WorkOrderCard({ wo, refs, due }: { wo: WorkOrder; refs: { c: Map<string, Customer>; v: Map<string, Vehicle> }; due?: number }) {
  const { settings } = useApp()
  const st = settings!.stages.find((s) => s.key === wo.stage)
  const v = refs.v.get(wo.vehicle_id)
  const late = !wo.delivered_at && wo.due_date && wo.due_date < today() && wo.stage !== 'pronto'
  return (
    <li>
      <RowLink to={`/os/${wo.id}`} className={late ? 'ring-red-300' : ''}>
        <div className="flex items-center gap-3">
          <Plate value={v?.plate} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{vehicleLabel(v)}</div>
            <div className="truncate text-xs text-slate-500">{refs.c.get(wo.customer_id)?.name}</div>
          </div>
          <StatusPill color={st?.color ?? '#64748b'}>{st?.name ?? wo.stage}</StatusPill>
        </div>
        <div className="mt-2 flex justify-between gap-2 text-xs text-slate-500">
          <span>{wo.delivered_at ? `Entregue ${date(wo.delivered_at)}` : `${daysBetween(wo.entry_date)} dia(s) aqui`}{due ? <span className="font-semibold text-amber-700"> • falta {money(due)}</span> : null}</span>
          {!wo.delivered_at && <span className={late ? 'font-bold text-red-600' : ''}>{wo.due_date ? `Entrega ${date(wo.due_date)}` : 'Sem previsão'}</span>}
        </div>
      </RowLink>
    </li>
  )
}
