import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChecklistEditor, emptyChecklist } from '../components/Checklist'
import { CustomerVehiclePicker } from '../components/CustomerVehiclePicker'
import { ItemsEditor } from '../components/ItemsEditor'
import { InsuranceEditor, PaymentTermsEditor } from '../components/PaymentEditors'
import { PhotoManager } from '../components/PhotoManager'
import { Button, ErrorBox, Field, Input, Loading, MoneyInput, OptionalSection, PageHeader, Section, TextArea } from '../components/ui'
import { useAction, useApp } from '../lib/app'
import { computeTotals, insuranceSplit } from '../lib/calc'
import { db } from '../lib/db'
import { newQuote, newWorkOrder } from '../lib/docs'
import { money, uid } from '../lib/format'
import type { Quote, WorkOrder } from '../lib/types'

type Kind = 'quote' | 'work_order'
type Doc = Partial<Quote & WorkOrder>

export default function DocEditor({ kind }: { kind: Kind }) {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { settings, session } = useApp()
  const { busy, run } = useAction()
  const table = kind === 'quote' ? 'quotes' : 'work_orders'
  const listPath = kind === 'quote' ? '/orcamentos' : '/os'
  const [doc, setDoc] = useState<Doc | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draftId] = useState(() => id ?? uid())

  useEffect(() => {
    if (!settings) return
    if (id) {
      db.get(table, id).then((d) => (d ? setDoc(d as Doc) : setError('Documento não encontrado'))).catch((e) => setError(e.message))
    } else {
      const d: Doc = kind === 'quote' ? newQuote(settings) : newWorkOrder()
      const c = params.get('cliente')
      const v = params.get('veiculo')
      if (c && v) Object.assign(d, { customer_id: c, vehicle_id: v })
      setDoc(d)
    }
  }, [id, settings, kind, table, params])

  const totals = useMemo(() => (doc ? computeTotals({ simple: !!doc.simple, simple_total: doc.simple_total, items: doc.items ?? [], discount: doc.discount ?? 0, surcharge: doc.surcharge ?? 0 }) : { subtotal: 0, total: 0 }), [doc])

  if (error) return <ErrorBox message={error} />
  if (!doc || !settings) return <Loading />

  const set = <K extends keyof Doc>(k: K, v: Doc[K]) => setDoc((d) => ({ ...d!, [k]: v }))
  const title = id ? `Editar ${doc.number}` : kind === 'quote' ? 'Novo orçamento' : 'Nova ordem de serviço'

  async function save() {
    if (!doc!.customer_id || !doc!.vehicle_id) throw new Error('Escolha o cliente e o veículo')
    if (!doc!.simple && (doc!.items ?? []).length === 0 && kind === 'quote') throw new Error('Adicione pelo menos um item ou use o formato simplificado')
    if (doc!.simple && !doc!.simple_description?.trim()) throw new Error('Descreva o serviço')
    if (doc!.insurance && !doc!.insurance.insurer.trim()) throw new Error('Informe o nome da seguradora')
    if (kind === 'work_order' && !doc!.entry_date) throw new Error('Informe a data de entrada')
    const row = { ...doc!, due_date: doc!.due_date || null }
    if (id) return db.update(table, id, row)
    const created = await db.insert(table, { ...row, id: draftId, number: '' } as never)
    if (kind === 'work_order') await db.insert('stage_events', { work_order_id: created.id, stage: (created as WorkOrder).stage, note: 'OS aberta' })
    return created
  }

  async function cancel() {
    if (!id) {
      const orphan = await db.list('photos', { parent_id: draftId })
      if (orphan.length && !confirm('Descartar este documento e as fotos adicionadas?')) return
      for (const p of orphan) {
        await db.remove('photos', p.id)
        await db.deleteFile(p.path)
      }
    }
    nav(id ? `${listPath}/${id}` : listPath)
  }

  const split = insuranceSplit(totals.total, doc.insurance)

  return (
    <div className="space-y-4 pb-28">
      <PageHeader title={title} />

      <CustomerVehiclePicker customerId={doc.customer_id} vehicleId={doc.vehicle_id} onChange={(c, v) => setDoc((d) => ({ ...d!, customer_id: c, vehicle_id: v }))} />

      <div className="grid grid-cols-2 gap-3">
        {kind === 'quote' ? (
          <>
            <Field label="Válido até">
              <Input type="date" value={doc.valid_until ?? ''} onChange={(e) => set('valid_until', e.target.value)} />
            </Field>
            <Field label="Prazo (dias)">
              <Input inputMode="numeric" value={doc.estimated_days ?? ''} onChange={(e) => set('estimated_days', e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null)} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Entrada">
              <Input type="date" value={doc.entry_date ?? ''} onChange={(e) => set('entry_date', e.target.value)} />
            </Field>
            <Field label="Previsão de entrega">
              <Input type="date" value={doc.due_date ?? ''} onChange={(e) => set('due_date', e.target.value || null)} />
            </Field>
          </>
        )}
      </div>

      <Section
        title="Serviços"
        right={
          <div className="flex rounded-lg border border-slate-300 p-0.5 text-sm">
            <button type="button" className={`rounded-md px-3 py-1 ${!doc.simple ? 'bg-slate-900 text-white' : ''}`} onClick={() => set('simple', false)}>Detalhado</button>
            <button type="button" className={`rounded-md px-3 py-1 ${doc.simple ? 'bg-slate-900 text-white' : ''}`} onClick={() => set('simple', true)}>Simples</button>
          </div>
        }
      >
        {doc.simple ? (
          <>
            <Field label="Descrição do serviço *">
              <TextArea rows={4} value={doc.simple_description ?? ''} onChange={(e) => set('simple_description', e.target.value)} />
            </Field>
            <Field label="Valor total">
              <MoneyInput value={doc.simple_total ?? 0} onChange={(v) => set('simple_total', v)} />
            </Field>
          </>
        ) : (
          <ItemsEditor items={doc.items ?? []} onChange={(items) => set('items', items)} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desconto">
            <MoneyInput value={doc.discount ?? 0} onChange={(v) => set('discount', v)} />
          </Field>
          <Field label="Acréscimo">
            <MoneyInput value={doc.surcharge ?? 0} onChange={(v) => set('surcharge', v)} />
          </Field>
        </div>
        {settings.cash_discount_percent > 0 && (
          <button type="button" className="text-sm font-semibold text-blue-700" onClick={() => set('discount', Math.round(totals.subtotal * settings.cash_discount_percent / 100))}>
            Aplicar desconto à vista ({settings.cash_discount_percent}%)
          </button>
        )}
      </Section>

      <OptionalSection
        title="Seguradora"
        addLabel="Serviço de seguradora"
        enabled={!!doc.insurance}
        onEnable={() => set('insurance', { insurer: '', deductible: 0, customer_pays: 0 })}
        onDisable={() => set('insurance', null)}
      >
        {doc.insurance && <InsuranceEditor ins={doc.insurance} total={totals.total} onChange={(i) => set('insurance', i)} />}
      </OptionalSection>

      <Section title="Forma de pagamento">
        <PaymentTermsEditor terms={doc.payment_terms!} onChange={(t) => set('payment_terms', t)} total={split.customer} settings={settings} hasInsurance={!!doc.insurance} />
      </Section>

      {kind === 'work_order' && (
        <OptionalSection
          title="Checklist de entrada"
          addLabel="Checklist de entrada do veículo"
          enabled={!!doc.checklist}
          onEnable={() => set('checklist', emptyChecklist())}
          onDisable={() => set('checklist', null)}
        >
          {doc.checklist && <ChecklistEditor value={doc.checklist} onChange={(c) => set('checklist', c)} />}
        </OptionalSection>
      )}

      <Section title="Fotos">
        {session?.organizationId && (
          <PhotoManager
            parentType={kind}
            parentId={draftId}
            vehicleId={doc.vehicle_id || undefined}
            stages={kind === 'work_order' ? settings.stages : undefined}
            defaultStage={kind === 'work_order' ? 'recebido' : undefined}
          />
        )}
      </Section>

      <Section title="Observações">
        <Field label="Para o cliente (aparece no documento)">
          <TextArea value={doc.customer_notes ?? ''} onChange={(e) => set('customer_notes', e.target.value)} />
        </Field>
        <Field label="Internas (só você vê)">
          <TextArea value={doc.internal_notes ?? ''} onChange={(e) => set('internal_notes', e.target.value)} />
        </Field>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:left-60">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex-1">
            <div className="text-xs text-slate-500">Total{doc.insurance ? ` • cliente ${money(split.customer)}` : ''}</div>
            <div className="text-xl font-bold">{money(totals.total)}</div>
          </div>
          <Button variant="secondary" onClick={cancel}>Cancelar</Button>
          <Button disabled={busy} onClick={async () => { const r = await run(save, 'Salvo'); if (r) nav(`${listPath}/${r.id}`, { replace: true }) }}>
            Salvar
          </Button>
        </div>
      </div>
    </div>
  )
}
