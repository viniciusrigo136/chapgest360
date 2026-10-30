import { installments, insuranceSplit } from '../lib/calc'
import { PAYMENT_METHODS } from '../lib/defaults'
import { money } from '../lib/format'
import type { Insurance, PaymentMethod, PaymentTerms, Settings } from '../lib/types'
import { Field, Input, MoneyInput, Select, TextArea } from './ui'

export function PaymentTermsEditor({ terms, onChange, total, settings, hasInsurance }: {
  terms: PaymentTerms; onChange: (t: PaymentTerms) => void; total: number; settings: Settings; hasInsurance: boolean
}) {
  const set = <K extends keyof PaymentTerms>(k: K, v: PaymentTerms[K]) => onChange({ ...terms, [k]: v })
  const toggle = (m: PaymentMethod) => set('methods', terms.methods.includes(m) ? terms.methods.filter((x) => x !== m) : [...terms.methods, m])
  const financed = Math.max(0, total - terms.down_payment)
  const inst = installments(financed, terms.installments, terms.installments > 1 ? settings.installment_fee_percent : 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PAYMENT_METHODS) as PaymentMethod[])
          .filter((m) => m !== 'seguradora' || hasInsurance)
          .map((m) => (
            <button key={m} type="button" onClick={() => toggle(m)}
              className={`min-h-10 rounded-full px-3.5 text-sm font-semibold ${terms.methods.includes(m) ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
              {PAYMENT_METHODS[m]}
            </button>
          ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Entrada">
          <MoneyInput value={terms.down_payment} onChange={(v) => set('down_payment', Math.min(v, total))} />
        </Field>
        <Field label="Parcelas">
          <Select value={terms.installments} onChange={(e) => set('installments', Number(e.target.value))}>
            {Array.from({ length: Math.max(1, settings.max_installments) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}x`}</option>
            ))}
          </Select>
        </Field>
      </div>
      {(terms.installments > 1 || terms.down_payment > 0) && (
        <p className="rounded-xl bg-white ring-1 ring-slate-200 px-3 py-2 text-sm">
          {terms.down_payment > 0 && <>Entrada de {money(terms.down_payment)}{financed > 0 ? ' + ' : ''}</>}
          {financed > 0 && (terms.installments > 1 ? <>{terms.installments}x de {money(inst.values[0])}{settings.installment_fee_percent > 0 && ` (total ${money(inst.total)})`}</> : <>{money(financed)} na entrega</>)}
        </p>
      )}
      {settings.pix_key && (
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={terms.show_pix_qr} onChange={(e) => set('show_pix_qr', e.target.checked)} />
          <span className="text-sm">Mostrar QR Code PIX no documento</span>
        </label>
      )}
      <Field label="Condições (opcional)">
        <TextArea rows={2} value={terms.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Ex.: 50% na aprovação e 50% na entrega" />
      </Field>
    </div>
  )
}

export function InsuranceEditor({ ins, onChange, total }: { ins: Insurance; onChange: (i: Insurance) => void; total: number }) {
  const set = <K extends keyof Insurance>(k: K, v: Insurance[K]) => onChange({ ...ins, [k]: v })
  const split = insuranceSplit(total, ins)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Seguradora" className="col-span-2">
          <Input value={ins.insurer} onChange={(e) => set('insurer', e.target.value)} placeholder="Nome da seguradora" />
        </Field>
        <Field label="Nº do sinistro">
          <Input value={ins.claim_number ?? ''} onChange={(e) => set('claim_number', e.target.value)} />
        </Field>
        <Field label="Franquia">
          <MoneyInput value={ins.deductible} onChange={(v) => onChange({ ...ins, deductible: v, customer_pays: ins.customer_pays === ins.deductible ? v : ins.customer_pays })} />
        </Field>
      </div>
      <Field label="Cliente paga" hint="Por padrão, o valor da franquia. O restante fica com a seguradora.">
        <MoneyInput value={ins.customer_pays} onChange={(v) => set('customer_pays', v)} />
      </Field>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-white ring-1 ring-slate-200 p-3"><div className="text-slate-600">Cliente</div><strong className="text-base">{money(split.customer)}</strong></div>
        <div className="rounded-xl bg-white ring-1 ring-slate-200 p-3"><div className="text-slate-600">Seguradora</div><strong className="text-base">{money(split.insurer)}</strong></div>
      </div>
    </div>
  )
}
