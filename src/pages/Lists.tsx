import { FilePlus2, FileText, Plus, Printer, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
import { WaIcon } from '../components/ShareBox'
import { useMemo, useState } from 'react'
import { Badge, Empty, LinkButton, Loading, PageHeader, Plate, RowLink, SearchInput, StatusPill, Tabs } from '../components/ui'
import { useApp, useLoad } from '../lib/app'
import { balance } from '../lib/calc'
import { db } from '../lib/db'
import { QUOTE_STATUS } from '../lib/defaults'
import { isQuoteExpired } from '../lib/docs'
import { date, daysBetween, money, normalizePlate, today } from '../lib/format'
import { fillTemplate, messageVars, vehicleLabel, whatsappUrl } from '../lib/share'
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
        <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
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
  const live = useMemo(() => (data?.orders ?? []).filter((x) => !x.archived_at), [data])
  const dueOf = (id: string, total: number) => balance(total, (data?.payments ?? []).filter((p) => p.work_order_id === id)).due
  const charging = (x: WorkOrder) => (x.stage === 'pronto' || x.stage === 'entregue') && dueOf(x.id, x.total) > 0
  const list = useMemo(() => live.filter((x) => {
    if (f === 'oficina' && x.stage === 'entregue') return false
    if (f === 'entregue' && x.stage !== 'entregue') return false
    if (f === 'cobranca' && !charging(x)) return false
    if (f === 'atrasados' && !isLate(x)) return false
    if (!['oficina', 'entregue', 'todos', 'cobranca', 'atrasados'].includes(f) && x.stage !== f) return false
    return matches(q, refs?.c.get(x.customer_id), refs?.v.get(x.vehicle_id), x.number)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }).sort((a, b) => ((a.due_date ?? '9') < (b.due_date ?? '9') ? -1 : 1)), [live, refs, q, f, data])

  if (!data || !refs || !settings) return <Loading />
  // Filtro por etapa só mostra etapas que têm carro agora.
  const stageTabs = settings.stages.filter((s) => s.key !== 'entregue' && live.some((x) => x.stage === s.key)).map((s) => ({ value: s.key, label: s.name, count: live.filter((x) => x.stage === s.key).length }))
  return (
    <div>
      <PageHeader title="Serviços" subtitle="Painel de atendimento" actions={<LinkButton to="/os/nova" icon={Plus} className="min-h-11">Receber carro</LinkButton>} />
      <div className="lg:max-w-xl"><SearchInput value={q} onChange={setQ} placeholder="Buscar nome, placa, carro ou número" /></div>
      <Tabs value={f} onChange={setF} options={[
        { value: 'oficina', label: 'Na oficina', count: live.filter((x) => x.stage !== 'entregue').length },
        { value: 'atrasados', label: 'Atrasados', count: live.filter(isLate).length },
        { value: 'cobranca', label: 'Em cobrança', count: live.filter(charging).length },
        ...stageTabs,
        { value: 'entregue', label: 'Entregues' },
        { value: 'todos', label: 'Todos' },
      ]} />
      {list.length === 0 ? (
        <Empty icon={Wrench} title={data.orders.length ? 'Nada por aqui' : 'Nenhum serviço ainda'} text="Abra um serviço a partir de um orçamento aprovado ou receba um carro direto."
          action={!data.orders.length && <LinkButton to="/os/nova" icon={Plus}>Receber um carro</LinkButton>} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{list.map((x) => <WorkOrderCard key={x.id} wo={x} refs={refs} due={dueOf(x.id, x.total)} />)}</ul>
      )}
    </div>
  )
}

const isLate = (wo: WorkOrder) => !wo.delivered_at && !!wo.due_date && wo.due_date < today() && wo.stage !== 'pronto'

/** Cartão do painel de atendimento: número, placa, etiquetas e atalhos. */
export function WorkOrderCard({ wo, refs, due }: { wo: WorkOrder; refs: { c: Map<string, Customer>; v: Map<string, Vehicle> }; due?: number }) {
  const { settings } = useApp()
  const st = settings!.stages.find((s) => s.key === wo.stage)
  const v = refs.v.get(wo.vehicle_id)
  const c = refs.c.get(wo.customer_id)
  const late = isLate(wo)
  const charging = (wo.stage === 'pronto' || wo.stage === 'entregue') && !!due
  const what = wo.simple ? wo.simple_description : wo.items.map((i) => i.description).join(' + ')
  const phoneNr = c?.whatsapp || c?.phone
  const msg = settings ? fillTemplate(wo.stage === 'pronto' ? settings.templates.ready : settings.templates.stage, messageVars({ customer: c, vehicle: v, number: wo.number, token: wo.public_token, stage: st?.name, due: wo.due_date })) : ''
  return (
    <li className={`flex flex-col rounded-2xl bg-card shadow-[0_1px_2px_rgba(19,32,58,0.06)] ring-1 ${late ? 'ring-red-300' : 'ring-slate-200/70'}`}>
      <Link to={`/os/${wo.id}`} className="flex-1 p-3.5 active:bg-slate-50">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-lg bg-panel px-2.5 py-1 text-sm font-extrabold text-white">Nº {wo.number.split('-').pop()}</span>
          <Plate value={v?.plate} size="sm" />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <StatusPill color={st?.color ?? '#64748b'}>{st?.name ?? wo.stage}</StatusPill>
          {late && <Badge className="bg-red-100 text-red-700">Atrasado</Badge>}
          {charging && <Badge className="bg-amber-100 text-amber-800">Em cobrança {money(due!)}</Badge>}
          {wo.insurance && <Badge className="bg-slate-100 text-slate-600">{wo.insurance.insurer}</Badge>}
        </div>
        <div className="mt-2 truncate text-xs font-medium uppercase tracking-wide text-slate-500">{c?.name}</div>
        <div className="truncate font-bold">{vehicleLabel(v)}</div>
        {what && <div className="mt-0.5 line-clamp-2 text-sm text-slate-600">{what}</div>}
      </Link>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3.5 py-2 text-xs text-slate-500">
        <span>
          {wo.delivered_at ? `Entregue ${date(wo.delivered_at)}` : `Entrada ${date(wo.entry_date)} • ${daysBetween(wo.entry_date)}d`}
          {!wo.delivered_at && wo.due_date && <span className={late ? 'font-bold text-red-600' : ''}> • entrega {date(wo.due_date)}</span>}
        </span>
        <span className="flex gap-1">
          <Link to={`/imprimir/work_order/${wo.id}`} aria-label="Imprimir" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Printer size={18} /></Link>
          {phoneNr && <a href={whatsappUrl(phoneNr, msg)} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex h-9 w-9 items-center justify-center rounded-lg text-wa hover:bg-slate-100"><WaIcon size={19} /></a>}
        </span>
      </div>
    </li>
  )
}
