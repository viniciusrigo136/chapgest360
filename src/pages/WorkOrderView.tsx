import { Archive, ArchiveRestore, ArrowRight, Banknote, CalendarClock, Camera, ClipboardCheck, FileDown, History, KeyRound, ListChecks, MessageSquareText, MoreHorizontal, Pencil, Plus, Receipt, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CarDiagram, SignatureField } from '../components/Checklist'
import { DocHero, ItemsSummary } from '../components/DocSummary'
import { PhotoManager } from '../components/PhotoManager'
import { ShareBox, WaIcon } from '../components/ShareBox'
import { Button, Collapsible, ErrorBox, Field, Input, LinkButton, Loading, MoneyInput, PageHeader, Section, Select, Sheet, StatusPill, TextArea } from '../components/ui'
import { useAction, useApp, useLoad } from '../lib/app'
import { balance, insuranceSplit } from '../lib/calc'
import { askConfirm } from '../lib/confirm'
import { db } from '../lib/db'
import { COST_CATEGORIES, DAMAGE_TYPES, PAYMENT_METHODS } from '../lib/defaults'
import { setStage } from '../lib/docs'
import { date, dateTime, daysBetween, money, randomToken, today } from '../lib/format'
import { fillTemplate, messageVars, whatsappUrl } from '../lib/share'
import type { Cost, PaymentMethod, WorkOrder } from '../lib/types'

export default function WorkOrderView() {
  const { id } = useParams()
  const { settings } = useApp()
  const { busy, run } = useAction()
  const [share, setShare] = useState(false)
  const [stageOpen, setStageOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [costOpen, setCostOpen] = useState(false)
  const [dueOpen, setDueOpen] = useState(false)
  const [notify, setNotify] = useState<string | null>(null)

  const { data, error } = useLoad(async () => {
    const wo = await db.get('work_orders', id!)
    if (!wo) throw new Error('Serviço não encontrado')
    const [customer, vehicle, events, payments, costs, quote] = await Promise.all([
      db.get('customers', wo.customer_id),
      db.get('vehicles', wo.vehicle_id),
      db.list('stage_events', { work_order_id: wo.id }),
      db.list('payments', { work_order_id: wo.id }),
      db.list('costs', { work_order_id: wo.id }),
      wo.quote_id ? db.get('quotes', wo.quote_id) : Promise.resolve(null),
    ])
    return { wo, customer, vehicle, events, payments, costs, quote }
  }, [id])

  if (error) return <ErrorBox message={error} />
  if (!data || !settings) return <Loading />
  const { wo, customer, vehicle, events, payments, costs, quote } = data
  const stages = settings.stages
  const idx = stages.findIndex((s) => s.key === wo.stage)
  const stage = stages[idx]
  const next = stages[idx + 1]
  const split = insuranceSplit(wo.total, wo.insurance)
  const { paid, due } = balance(wo.total, payments)
  const costTotal = costs.reduce((s, c) => s + c.amount, 0)
  const days = daysBetween(wo.entry_date, wo.delivered_at ? wo.delivered_at.slice(0, 10) : today())
  const late = !wo.delivered_at && wo.due_date && wo.due_date < today()
  const vars = (stageName?: string) => messageVars({ customer, vehicle, number: wo.number, token: wo.public_token, stage: stageName, due: wo.due_date })
  const waPhone = customer?.whatsapp || customer?.phone

  async function changeStage(key: string, note: string) {
    const r = await run(() => setStage(wo, key, note, settings!), 'Etapa atualizada')
    if (r) {
      const st = stages.find((s) => s.key === key)!
      const tpl = key === 'pronto' ? settings!.templates.ready : settings!.templates.stage
      if (st.public && key !== 'entregue') setNotify(fillTemplate(tpl, vars(st.name)))
    }
    setStageOpen(false)
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`Serviço ${wo.number.split('-').pop()}`} subtitle={`${wo.number} • chegou ${date(wo.entry_date)}`} back="/os"
        actions={<StatusPill color={stage?.color ?? '#64748b'}>{stage?.name ?? wo.stage}</StatusPill>} />
      {wo.archived_at && <ErrorBox message="Este serviço está arquivado." />}

      <DocHero customer={customer} vehicle={vehicle} total={wo.total} label="Total"
        extra={
          <div className="space-y-2">
            <div className="flex gap-1" aria-label={`Etapa ${idx + 1} de ${stages.length}`}>
              {stages.map((s, i) => <div key={s.key} title={s.name} className="h-2 flex-1 rounded-full" style={{ background: i <= idx ? (stage?.color ?? '#1f47c7') : '#e5e9f0' }} />)}
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>{wo.delivered_at ? `Entregue em ${date(wo.delivered_at)}` : `${days} dia(s) na oficina`}</span>
              <button type="button" onClick={() => setDueOpen(true)} className={`font-semibold ${late ? 'text-red-600' : 'text-brand-600'}`}>
                {wo.due_date ? `Entrega ${date(wo.due_date)}${late ? ' • atrasado' : ''}` : 'Definir previsão'}
              </button>
            </div>
          </div>
        }
      />

      {next && !wo.archived_at && (
        <Button className="min-h-14 w-full text-base" icon={next.key === 'entregue' ? KeyRound : ArrowRight} disabled={busy} onClick={() => changeStage(next.key, '')}>
          {next.key === 'entregue' ? 'Entregar o carro' : `Avançar para: ${next.name}`}
        </Button>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button variant="whatsapp" onClick={() => setShare(true)}><WaIcon /> Link do cliente</Button>
        <LinkButton to={`/imprimir/work_order/${wo.id}`} variant="secondary" icon={FileDown}>PDF</LinkButton>
      </div>

      <Section title="Pagamento" icon={Wallet} right={due > 0 ? <Button variant="ghost" icon={Plus} className="min-h-10 px-2" onClick={() => setPayOpen(true)}>Receber</Button> : <span className="text-sm font-bold text-emerald-700">Pago ✓</span>}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Money label="Total" value={wo.total} />
          <Money label="Pago" value={paid} tone="text-emerald-700" />
          <Money label="Falta" value={due} tone={due ? 'text-amber-700' : 'text-slate-400'} />
        </div>
        {wo.insurance && <p className="text-xs text-slate-500">Cliente: {money(split.customer)} • Seguradora: {money(split.insurer)}</p>}
        {payments.length > 0 && (
          <ul className="divide-y divide-slate-100 text-sm">
            {payments.map((p) => (
              <li key={p.id} className={`flex items-center justify-between gap-2 py-2 ${p.reversed_at ? 'text-slate-400 line-through' : ''}`}>
                <span>{date(p.paid_at)} • {PAYMENT_METHODS[p.method]}{p.notes ? ` • ${p.notes}` : ''}</span>
                <span className="flex items-center gap-2">
                  <strong className="tnum">{money(p.amount)}</strong>
                  {!p.reversed_at && (
                    <button type="button" className="text-xs font-semibold text-red-600 no-underline" onClick={async () => (await askConfirm('Estornar este recebimento? Ele continua no histórico, riscado.', 'Estornar')) && run(() => db.update('payments', p.id, { reversed_at: new Date().toISOString() }), 'Estornado')}>
                      estornar
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {due > 0 && <Button className="w-full" variant="secondary" icon={Banknote} onClick={() => setPayOpen(true)}>Receber pagamento</Button>}
      </Section>

      <Section title="Fotos do serviço" icon={Camera}>
        <PhotoManager parentType="work_order" parentId={wo.id} vehicleId={wo.vehicle_id} stages={stages} defaultStage={wo.stage} />
      </Section>

      <Collapsible title="Serviços" icon={ListChecks} subtitle={wo.simple ? 'Valor total' : `${wo.items.length} item(ns)`}>
        <ItemsSummary doc={wo} />
        <LinkButton to={`/os/${wo.id}/editar`} variant="secondary" icon={Pencil} className="w-full">Editar serviços e opções</LinkButton>
      </Collapsible>

      {wo.checklist && (
        <Collapsible title="Checklist de entrada" icon={ClipboardCheck} subtitle={`${wo.checklist.damages.length} avaria(s) marcada(s)`}>
          <div className="flex gap-4">
            <CarDiagram damages={wo.checklist.damages} small />
            <div className="flex-1 space-y-1 text-sm">
              <p>Km: <strong>{wo.checklist.km ?? '—'}</strong></p>
              <p>Combustível: <strong>{['Vazio', '1/4', '1/2', '3/4', 'Cheio'][wo.checklist.fuel]}</strong></p>
              {wo.checklist.damages.map((d, i) => <p key={i}>• {d.region}: {DAMAGE_TYPES[d.type]}{d.note ? ` (${d.note})` : ''}</p>)}
              {wo.checklist.items.length > 0 && <p>Itens: {wo.checklist.items.join(', ')}</p>}
              {wo.checklist.belongings && <p>Objetos: {wo.checklist.belongings}</p>}
              {wo.checklist.signed_by && <p>Assinado por {wo.checklist.signed_by}</p>}
            </div>
          </div>
        </Collapsible>
      )}

      <Collapsible title="Gastos com este carro" icon={Receipt} subtitle={costs.length ? `${money(costTotal)} • sobra ${money(wo.total - costTotal)}` : 'Tinta, peças, terceiros'}>
        {costs.length === 0 ? <p className="text-sm text-slate-500">Anote o que gastou para saber quanto sobrou neste serviço.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {costs.map((c) => (
              <li key={c.id} className="flex justify-between gap-2 py-2">
                <span>{COST_CATEGORIES[c.category]} • {c.description}</span>
                <span className="flex gap-2"><strong className="tnum">{money(c.amount)}</strong>
                  <button type="button" className="text-red-600" aria-label="Remover" onClick={async () => (await askConfirm('Remover este gasto?', 'Remover')) && run(() => db.remove('costs', c.id))}>✕</button></span>
              </li>
            ))}
          </ul>
        )}
        {costs.length > 0 && (
          <div className="flex justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <span>Sobra (total − gastos)</span>
            <strong className={`tnum ${wo.total - costTotal < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{money(wo.total - costTotal)}</strong>
          </div>
        )}
        <Button variant="secondary" icon={Plus} className="w-full" onClick={() => setCostOpen(true)}>Anotar gasto</Button>
      </Collapsible>

      <Collapsible title="Histórico" icon={History} subtitle={`${events.length} atualização(ões)`}>
        <ul className="space-y-3 text-sm">
          {[...events].reverse().map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: stages.find((s) => s.key === e.stage)?.color ?? '#94a3b8' }} />
              <span><strong>{stages.find((s) => s.key === e.stage)?.name ?? e.stage}</strong> <span className="text-slate-500">• {dateTime(e.created_at)}</span>{e.note ? <span className="block text-slate-600">{e.note}</span> : null}</span>
            </li>
          ))}
        </ul>
        {quote && <p className="text-sm">Veio do orçamento <Link className="font-semibold text-brand-600" to={`/orcamentos/${quote.id}`}>{quote.number}</Link></p>}
      </Collapsible>

      <Collapsible title="Mais ações" icon={MoreHorizontal} subtitle="Outra etapa, recado, recibo, arquivar">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" icon={MessageSquareText} onClick={() => setStageOpen(true)}>Etapa / recado</Button>
          <Button variant="secondary" icon={CalendarClock} onClick={() => setDueOpen(true)}>Previsão</Button>
          {paid > 0 && <LinkButton to={`/imprimir/recibo/${wo.id}`} variant="secondary" icon={Receipt}>Recibo</LinkButton>}
          {wo.archived_at ? (
            <Button variant="secondary" icon={ArchiveRestore} onClick={() => run(() => db.update('work_orders', wo.id, { archived_at: null }), 'Restaurado')}>Restaurar</Button>
          ) : (
            <Button variant="danger" icon={Archive} onClick={async () => (await askConfirm('Arquivar este serviço?', 'Arquivar')) && run(() => db.update('work_orders', wo.id, { archived_at: new Date().toISOString() }), 'Arquivado')}>Arquivar</Button>
          )}
        </div>
        {wo.delivered_at && (
          <SignatureField label="Assinatura de quem retirou o carro" value={wo.delivery_signature} name={customer?.name}
            onChange={(sig) => run(() => db.update('work_orders', wo.id, { delivery_signature: sig ?? null }), 'Assinatura salva')} />
        )}
        {wo.internal_notes && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><strong>Só você vê:</strong> {wo.internal_notes}</p>}
      </Collapsible>

      {stageOpen && <StageSheet wo={wo} onClose={() => setStageOpen(false)} onSave={changeStage} />}
      {payOpen && <PaymentSheet wo={wo} due={due} onClose={() => setPayOpen(false)} />}
      {costOpen && <CostSheet woId={wo.id} hourly={settings.hourly_rate} onClose={() => setCostOpen(false)} />}
      {dueOpen && <DueSheet wo={wo} onClose={() => setDueOpen(false)} />}
      <Sheet open={!!notify} onClose={() => setNotify(null)} title="Avisar o cliente?">
        <div className="rounded-2xl bg-[#e7f7ec] p-3 text-sm leading-relaxed">{notify}</div>
        <a href={whatsappUrl(waPhone, notify ?? '')} target="_blank" rel="noreferrer" onClick={() => setNotify(null)}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-wa font-bold text-white"><WaIcon size={22} /> Enviar pelo WhatsApp</a>
        <Button variant="secondary" className="w-full" onClick={() => setNotify(null)}>Agora não</Button>
      </Sheet>
      <ShareBox
        open={share}
        onClose={() => setShare(false)}
        token={wo.public_token}
        enabled={wo.public_enabled}
        lastViewed={wo.last_viewed_at}
        phone={waPhone}
        message={fillTemplate(settings.templates.work_order, vars(stage?.name))}
        onToggle={(enabled) => run(() => db.update('work_orders', wo.id, { public_enabled: enabled }))}
        onRegenerate={() => run(() => db.update('work_orders', wo.id, { public_token: randomToken() }), 'Novo link gerado')}
      />
    </div>
  )
}

const Money = ({ label, value, tone = '' }: { label: string; value: number; tone?: string }) => (
  <div className="rounded-xl bg-slate-50 px-2 py-2.5">
    <div className="text-xs font-medium text-slate-500">{label}</div>
    <div className={`tnum text-[15px] font-extrabold ${tone}`}>{money(value)}</div>
  </div>
)

function DueSheet({ wo, onClose }: { wo: WorkOrder; onClose: () => void }) {
  const { run } = useAction()
  const [d, setD] = useState(wo.due_date ?? '')
  return (
    <Sheet open onClose={onClose} title="Previsão de entrega">
      <Input type="date" value={d} onChange={(e) => setD(e.target.value)} />
      <Button className="w-full" onClick={async () => { await run(() => db.update('work_orders', wo.id, { due_date: d || null }), 'Previsão atualizada'); onClose() }}>Salvar</Button>
    </Sheet>
  )
}

function StageSheet({ wo, onClose, onSave }: { wo: WorkOrder; onClose: () => void; onSave: (stage: string, note: string) => void }) {
  const { settings } = useApp()
  const [stage, setStageKey] = useState(wo.stage)
  const [note, setNote] = useState('')
  return (
    <Sheet open onClose={onClose} title="Etapa e recado">
      <Field label="Etapa">
        <Select value={stage} onChange={(e) => setStageKey(e.target.value)}>
          {settings!.stages.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
        </Select>
      </Field>
      <Field label="Recado para o cliente (aparece na página dele)">
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: A peça chegou, começamos a montagem hoje." />
      </Field>
      <Button className="w-full" onClick={() => onSave(stage, note.trim())}>Salvar</Button>
    </Sheet>
  )
}

function PaymentSheet({ wo, due, onClose }: { wo: WorkOrder; due: number; onClose: () => void }) {
  const { run, busy } = useAction()
  const [amount, setAmount] = useState(due)
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [paidAt, setPaidAt] = useState(today())
  const [notes, setNotes] = useState('')
  const quick: PaymentMethod[] = ['pix', 'dinheiro', 'credito', 'debito']
  return (
    <Sheet open onClose={onClose} title="Receber pagamento">
      <Field label="Valor" hint={`Falta receber ${money(due)}`}>
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>
      <div className="grid grid-cols-4 gap-2">
        {quick.map((m) => (
          <button key={m} type="button" onClick={() => setMethod(m)} className={`min-h-12 rounded-xl text-sm font-semibold ${method === m ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-slate-200'}`}>
            {m === 'credito' ? 'Crédito' : m === 'debito' ? 'Débito' : PAYMENT_METHODS[m]}
          </button>
        ))}
      </div>
      <details className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <summary className="cursor-pointer text-sm font-semibold text-slate-600">Outra forma, data ou observação</summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Forma">
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => <option key={m} value={m}>{PAYMENT_METHODS[m]}</option>)}
              </Select>
            </Field>
            <Field label="Data">
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </Field>
          </div>
          <Field label="Observação">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: entrada, 2ª parcela" />
          </Field>
        </div>
      </details>
      <Button className="min-h-14 w-full text-base" disabled={busy} onClick={async () => {
        const r = await run(async () => {
          if (amount <= 0) throw new Error('Informe o valor')
          if (amount > due) throw new Error(`Valor maior do que falta receber (${money(due)})`)
          return db.insert('payments', { work_order_id: wo.id, customer_id: wo.customer_id, amount, method, paid_at: paidAt, payer: method === 'seguradora' ? 'seguradora' : 'cliente', notes })
        }, 'Pagamento registrado')
        if (r) onClose()
      }}>Registrar {money(amount)}</Button>
    </Sheet>
  )
}

function CostSheet({ woId, hourly, onClose }: { woId: string; hourly: number; onClose: () => void }) {
  const { run, busy } = useAction()
  const [c, setC] = useState<Partial<Cost>>({ category: 'material', description: '', amount: 0, spent_at: today() })
  return (
    <Sheet open onClose={onClose} title="Anotar gasto">
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(COST_CATEGORIES) as Cost['category'][]).map((k) => (
          <button key={k} type="button" onClick={() => setC({ ...c, category: k })} className={`min-h-11 rounded-xl px-1 text-sm font-semibold ${c.category === k ? 'bg-brand-600 text-white' : 'bg-white ring-1 ring-slate-200'}`}>
            {COST_CATEGORIES[k]}
          </button>
        ))}
      </div>
      <Field label="O que foi">
        <Input value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} placeholder="Ex.: Tinta prata 900ml" />
      </Field>
      {c.category === 'horas' && (
        <Field label="Horas" hint={hourly ? `Sua hora: ${money(hourly)}` : 'Defina o valor da sua hora nas Configurações'}>
          <Input inputMode="decimal" value={c.hours ?? ''} onChange={(e) => { const h = Number(e.target.value.replace(',', '.')) || 0; setC({ ...c, hours: h, amount: Math.round(h * hourly) }) }} />
        </Field>
      )}
      <Field label="Valor">
        <MoneyInput value={c.amount ?? 0} onChange={(v) => setC({ ...c, amount: v })} />
      </Field>
      <Button className="w-full" disabled={busy} onClick={async () => {
        const r = await run(async () => {
          if (!c.description?.trim()) throw new Error('Diga o que foi o gasto')
          return db.insert('costs', { ...(c as Cost), work_order_id: woId, description: c.description.trim() })
        }, 'Gasto anotado')
        if (r) onClose()
      }}>Salvar</Button>
    </Sheet>
  )
}
