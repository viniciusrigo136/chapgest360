import { useState } from 'react'
import { useAction } from '../lib/app'
import { db } from '../lib/db'
import { digits, isValidDocument, isValidPlate, normalizePlate } from '../lib/format'
import type { Customer, Vehicle } from '../lib/types'
import { Button, Field, Input, TextArea } from './ui'

export function CustomerForm({ initial, onSaved }: { initial?: Customer; onSaved: (c: Customer) => void }) {
  const { busy, run } = useAction()
  const [c, setC] = useState<Partial<Customer>>(initial ?? {})
  const set = (k: keyof Customer, v: string) => setC((x) => ({ ...x, [k]: v }))
  const docErr = c.document && !isValidDocument(c.document) ? 'CPF/CNPJ inválido' : null

  async function save() {
    const name = (c.name ?? '').trim()
    if (!name) throw new Error('Informe o nome do cliente')
    if (docErr) throw new Error(docErr)
    const row = { ...c, name, phone: digits(c.phone), whatsapp: digits(c.whatsapp || c.phone), document: digits(c.document) }
    return initial ? db.update('customers', initial.id, row) : db.insert('customers', row as Customer)
  }

  return (
    <div className="space-y-3">
      <Field label="Nome ou razão social *">
        <Input value={c.name ?? ''} onChange={(e) => set('name', e.target.value)} autoComplete="off" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Telefone / WhatsApp">
          <Input type="tel" inputMode="tel" value={c.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="(00) 00000-0000" />
        </Field>
        <Field label="CPF/CNPJ" error={docErr}>
          <Input inputMode="numeric" value={c.document ?? ''} onChange={(e) => set('document', e.target.value)} />
        </Field>
      </div>
      <details className="rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Mais dados (opcional)</summary>
        <div className="mt-3 space-y-3">
          <Field label="WhatsApp (se diferente do telefone)">
            <Input type="tel" inputMode="tel" value={c.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={c.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Endereço">
            <Input value={c.address ?? ''} onChange={(e) => set('address', e.target.value)} />
          </Field>
          <Field label="Como conheceu a oficina">
            <Input value={c.source ?? ''} onChange={(e) => set('source', e.target.value)} placeholder="Indicação, Instagram, seguradora…" />
          </Field>
          <Field label="Observações">
            <TextArea value={c.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
      </details>
      <Button className="w-full" disabled={busy} onClick={async () => { const r = await run(save, 'Cliente salvo'); if (r) onSaved(r) }}>
        Salvar cliente
      </Button>
    </div>
  )
}

export function VehicleForm({ customerId, initial, onSaved }: { customerId: string; initial?: Vehicle; onSaved: (v: Vehicle) => void }) {
  const { busy, run } = useAction()
  const [v, setV] = useState<Partial<Vehicle>>(initial ?? {})
  const set = (k: keyof Vehicle, val: string | number | null) => setV((x) => ({ ...x, [k]: val }))
  const plateErr = v.plate && !isValidPlate(v.plate) ? 'Placa inválida (ex.: ABC1D23 ou ABC1234)' : null

  async function save() {
    const plate = normalizePlate(v.plate ?? '')
    if (!isValidPlate(plate)) throw new Error('Informe uma placa válida')
    const row = { ...v, plate, customer_id: customerId }
    return initial ? db.update('vehicles', initial.id, row) : db.insert('vehicles', row as Vehicle)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Placa *" error={plateErr}>
          <Input value={v.plate ?? ''} onChange={(e) => set('plate', normalizePlate(e.target.value))} autoCapitalize="characters" placeholder="ABC1D23" className="uppercase" />
        </Field>
        <Field label="Cor">
          <Input value={v.color ?? ''} onChange={(e) => set('color', e.target.value)} />
        </Field>
        <Field label="Marca">
          <Input value={v.brand ?? ''} onChange={(e) => set('brand', e.target.value)} placeholder="VW, Fiat…" />
        </Field>
        <Field label="Modelo">
          <Input value={v.model ?? ''} onChange={(e) => set('model', e.target.value)} placeholder="Gol, Uno…" />
        </Field>
        <Field label="Ano/modelo">
          <Input inputMode="numeric" value={v.year ?? ''} onChange={(e) => set('year', e.target.value)} placeholder="2018/2019" />
        </Field>
        <Field label="Km">
          <Input inputMode="numeric" value={v.km ?? ''} onChange={(e) => set('km', e.target.value ? Number(digits(e.target.value)) : null)} />
        </Field>
      </div>
      <details className="rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Mais dados (opcional)</summary>
        <div className="mt-3 space-y-3">
          <Field label="Código da cor / tinta">
            <Input value={v.paint_code ?? ''} onChange={(e) => set('paint_code', e.target.value)} />
          </Field>
          <Field label="Chassi">
            <Input value={v.vin ?? ''} onChange={(e) => set('vin', e.target.value.toUpperCase())} />
          </Field>
          <Field label="Observações">
            <TextArea value={v.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
      </details>
      <Button className="w-full" disabled={busy} onClick={async () => { const r = await run(save, 'Veículo salvo'); if (r) onSaved(r) }}>
        Salvar veículo
      </Button>
    </div>
  )
}
