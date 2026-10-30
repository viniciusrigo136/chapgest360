import { askConfirm } from '../lib/confirm'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CarDiagram, SignatureField } from '../components/Checklist'
import { ItemsSummary, PartiesCard } from '../components/DocSummary'
import { PhotoManager } from '../components/PhotoManager'
import { ShareBox } from '../components/ShareBox'
import { Badge, Button, Card, ErrorBox, Field, Input, LinkButton, Loading, MoneyInput, PageHeader, Section, Select, Sheet, TextArea } from '../components/ui'
import { useAction, useApp, useLoad } from '../lib/app'
import { activePayments, balance, insuranceSplit } from '../lib/calc'
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
  const [notify, setNotify] = useState<string | null>(null)

  const { data, error } = useLoad(async () => {
    const wo = await db.get('work_orders', id!)
    if (!wo) throw new Error('OS não encontrada')
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
      if (st.public) setNotify(fillTemplate(tpl, vars(st.name)))
    }
    setStageOpen(false)
  }

  return (
    <div className="space-y-4">
      <PageHeader title={wo.number} back="/os" actions={<Badge style={{ background: stage?.color, color: '#fff' }}>{stage?.name ?? wo.stage}</Badge>} />
      {wo.archived_at && <ErrorBox message="Esta OS está arquivada." />}
      <PartiesCard customer={customer} vehicle={vehicle} />

      <Card className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span>{wo.delivered_at ? `Entregue em ${date(wo.delivered_at)}` : `${days} dia(s) na oficina`}</span>
          <span className={late ? 'font-bold text-red-700' : ''}>Previsão: {date(wo.due_date)}{late ? ' (atrasada)' : ''}</span>
        </div>
        <div className="flex gap-1" aria-label="Progresso">
          {stages.map((s, i) => <div key={s.key} title={s.name} className="h-2 flex-1 rounded" style={{ background: i <= idx ? s.color : '#e2e8f0' }} />)}
        </div>
        {next && !wo.archived_at && (
          <Button className="w-full" disabled={busy} onClick={() => changeStage(next.key, '')}>Avançar para: {next.name}</Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setStageOpen(true)}>Outra etapa / nota</Button>
          <DueDateButton wo={wo} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="success" onClick={() => setShare(true)}>WhatsApp / Link</Button>
        <LinkButton to={`/imprimir/work_order/${wo.id}`} variant="secondary">Imprimir / PDF</LinkButton>
      </div>

      <Section title="Fotos">
        <PhotoManager parentType="work_order" parentId={wo.id} vehicleId={wo.vehicle_id} stages={stages} defaultStage={wo.stage} />
      </Section>

      <ItemsSummary doc={wo} />

      <Section title="Recebimentos" right={<Button variant="ghost" onClick={() => setPayOpen(true)} disabled={due === 0}>+ Receber</Button>}>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg bg-slate-100 p-2"><div className="text-slate-600">Total</div><strong>{money(wo.total)}</strong></div>
          <div className="rounded-lg bg-green-50 p-2"><div className="text-green-800">Recebido</div><strong>{money(paid)}</strong></div>
          <div className={`rounded-lg p-2 ${due ? 'bg-amber-50' : 'bg-slate-100'}`}><div className="text-amber-900">Saldo</div><strong>{money(due)}</strong></div>
        </div>
        {wo.insurance && <p className="text-xs text-slate-600">Cliente: {money(split.customer)} • Seguradora: {money(split.insurer)}</p>}
        <ul className="divide-y divide-slate-100 text-sm">
          {payments.map((p) => (
            <li key={p.id} className={`flex items-center justify-between py-2 ${p.reversed_at ? 'text-slate-400 line-through' : ''}`}>
              <span>{date(p.paid_at)} • {PAYMENT_METHODS[p.method]}{p.payer === 'seguradora' ? ' (seguradora)' : ''}{p.notes ? ` • ${p.notes}` : ''}</span>
              <span className="flex items-center gap-2">
                <strong>{money(p.amount)}</strong>
                {!p.reversed_at && (
                  <button type="button" className="text-xs font-semibold text-red-700 no-underline" onClick={async () => await askConfirm('Estornar este recebimento? Ele continuará no histórico, riscado.') && run(() => db.update('payments', p.id, { reversed_at: new Date().toISOString() }), 'Estornado')}>
                    estornar
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
        {activePayments(payments).length > 0 && <LinkButton to={`/imprimir/recibo/${wo.id}`} variant="ghost" className="w-full">Imprimir recibo</LinkButton>}
      </Section>

      <Section title="Custos da OS" right={<Button variant="ghost" onClick={() => setCostOpen(true)}>+ Custo</Button>}>
        {costs.length === 0 ? <p className="text-sm text-slate-500">Registre tintas, peças, terceiros e horas para ver o resultado da OS.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {costs.map((c) => (
              <li key={c.id} className="flex justify-between py-2">
                <span>{COST_CATEGORIES[c.category]} • {c.description}</span>
                <span className="flex gap-2"><strong>{money(c.amount)}</strong>
                  <button type="button" className="text-red-600" aria-label="Remover" onClick={async () => await askConfirm('Remover este custo?') && run(() => db.remove('costs', c.id))}>✕</button></span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
          <span>Resultado estimado (total − custos lançados)</span>
          <strong className={wo.total - costTotal < 0 ? 'text-red-700' : 'text-green-800'}>{money(wo.total - costTotal)}</strong>
        </div>
        <p className="text-xs text-slate-500">Não inclui despesas gerais da oficina (aluguel, energia, impostos) nem custos que você não lançou.</p>
      </Section>

      {wo.checklist && (
        <Section title="Checklist de entrada">
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
        </Section>
      )}

      {stage?.key === 'entregue' || wo.delivered_at ? (
        <Section title="Entrega">
          <SignatureField label="Assinatura de recebimento do veículo" value={wo.delivery_signature} name={customer?.name}
            onChange={(sig) => run(() => db.update('work_orders', wo.id, { delivery_signature: sig ?? null }), 'Assinatura salva')} />
        </Section>
      ) : null}

      <Section title="Histórico">
        <ul className="space-y-2 text-sm">
          {[...events].reverse().map((e) => (
            <li key={e.id} className="flex gap-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: stages.find((s) => s.key === e.stage)?.color ?? '#94a3b8' }} />
              <span><strong>{stages.find((s) => s.key === e.stage)?.name ?? e.stage}</strong> • {dateTime(e.created_at)}{e.note ? <span className="block text-slate-600">{e.note}</span> : null}</span>
            </li>
          ))}
        </ul>
        {quote && <p className="text-sm">Origem: <Link className="font-semibold text-blue-700" to={`/orcamentos/${quote.id}`}>{quote.number}</Link></p>}
      </Section>

      {wo.internal_notes && <Card className="border-amber-200 bg-amber-50 text-sm"><strong>Interno:</strong> {wo.internal_notes}</Card>}

      <div className="grid grid-cols-2 gap-2 pb-4">
        <LinkButton to={`/os/${wo.id}/editar`} variant="secondary">Editar</LinkButton>
        {wo.archived_at ? (
          <Button variant="secondary" onClick={() => run(() => db.update('work_orders', wo.id, { archived_at: null }), 'Restaurada')}>Restaurar</Button>
        ) : (
          <Button variant="danger" onClick={async () => await askConfirm('Arquivar esta OS?') && run(() => db.update('work_orders', wo.id, { archived_at: new Date().toISOString() }), 'Arquivada')}>Arquivar</Button>
        )}
      </div>

      {stageOpen && <StageSheet wo={wo} onClose={() => setStageOpen(false)} onSave={changeStage} />}
      {payOpen && <PaymentSheet wo={wo} due={due} onClose={() => setPayOpen(false)} />}
      {costOpen && <CostSheet woId={wo.id} hourly={settings.hourly_rate} onClose={() => setCostOpen(false)} />}
      <Sheet open={!!notify} onClose={() => setNotify(null)} title="Avisar o cliente?">
        <p className="rounded-lg bg-slate-100 p-3 text-sm">{notify}</p>
        <a href={whatsappUrl(waPhone, notify ?? '')} target="_blank" rel="noreferrer" onClick={() => setNotify(null)}
          className="flex min-h-12 items-center justify-center rounded-lg bg-green-600 font-bold text-white">Enviar pelo WhatsApp</a>
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

function DueDateButton({ wo }: { wo: WorkOrder }) {
  const { run } = useAction()
  const [open, setOpen] = useState(false)
  const [d, setD] = useState(wo.due_date ?? '')
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>Previsão</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Previsão de entrega">
        <Input type="date" value={d} onChange={(e) => setD(e.target.value)} />
        <Button className="w-full" onClick={async () => { await run(() => db.update('work_orders', wo.id, { due_date: d || null }), 'Previsão atualizada'); setOpen(false) }}>Salvar</Button>
      </Sheet>
    </>
  )
}

function StageSheet({ wo, onClose, onSave }: { wo: WorkOrder; onClose: () => void; onSave: (stage: string, note: string) => void }) {
  const { settings } = useApp()
  const [stage, setStageKey] = useState(wo.stage)
  const [note, setNote] = useState('')
  return (
    <Sheet open onClose={onClose} title="Atualizar etapa">
      <Field label="Etapa">
        <Select value={stage} onChange={(e) => setStageKey(e.target.value)}>
          {settings!.stages.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
        </Select>
      </Field>
      <Field label="Recado para o cliente (aparece na página dele)">
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: Peça chegou, começamos a montagem hoje." />
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
  return (
    <Sheet open onClose={onClose} title="Registrar recebimento">
      <Field label="Valor" hint={`Saldo: ${money(due)}`}>
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>
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
      <Button className="w-full" disabled={busy} onClick={async () => {
        const r = await run(async () => {
          if (amount <= 0) throw new Error('Informe o valor')
          if (amount > due) throw new Error(`Valor maior que o saldo (${money(due)})`)
          return db.insert('payments', { work_order_id: wo.id, customer_id: wo.customer_id, amount, method, paid_at: paidAt, payer: method === 'seguradora' ? 'seguradora' : 'cliente', notes })
        }, 'Recebimento registrado')
        if (r) onClose()
      }}>Registrar</Button>
    </Sheet>
  )
}

function CostSheet({ woId, hourly, onClose }: { woId: string; hourly: number; onClose: () => void }) {
  const { run, busy } = useAction()
  const [c, setC] = useState<Partial<Cost>>({ category: 'material', description: '', amount: 0, spent_at: today() })
  return (
    <Sheet open onClose={onClose} title="Lançar custo">
      <Field label="Categoria">
        <Select value={c.category} onChange={(e) => setC({ ...c, category: e.target.value as Cost['category'] })}>
          {Object.entries(COST_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </Field>
      <Field label="Descrição">
        <Input value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} />
      </Field>
      {c.category === 'horas' && (
        <Field label="Horas" hint={hourly ? `Valor/hora: ${money(hourly)}` : 'Configure o valor/hora em Configurações'}>
          <Input inputMode="decimal" value={c.hours ?? ''} onChange={(e) => { const h = Number(e.target.value.replace(',', '.')) || 0; setC({ ...c, hours: h, amount: Math.round(h * hourly) }) }} />
        </Field>
      )}
      <Field label="Valor">
        <MoneyInput value={c.amount ?? 0} onChange={(v) => setC({ ...c, amount: v })} />
      </Field>
      <Button className="w-full" disabled={busy} onClick={async () => {
        const r = await run(async () => {
          if (!c.description?.trim()) throw new Error('Descreva o custo')
          return db.insert('costs', { ...(c as Cost), work_order_id: woId, description: c.description.trim() })
        }, 'Custo lançado')
        if (r) onClose()
      }}>Salvar</Button>
    </Sheet>
  )
}
