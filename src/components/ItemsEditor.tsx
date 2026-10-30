import { useState } from 'react'
import { useLoad } from '../lib/app'
import { itemSubtotal } from '../lib/calc'
import { db } from '../lib/db'
import { REGIONS, UNITS } from '../lib/defaults'
import { money, uid } from '../lib/format'
import type { DocItem, ItemKind } from '../lib/types'
import { Button, Field, Input, MoneyInput, Select, Sheet } from './ui'

export const KIND_LABEL: Record<ItemKind, string> = { service: 'Mão de obra', part: 'Peça', material: 'Material' }

export function ItemsEditor({ items, onChange }: { items: DocItem[]; onChange: (items: DocItem[]) => void }) {
  const [editing, setEditing] = useState<DocItem | null>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)

  const save = (it: DocItem) => {
    onChange(items.some((x) => x.id === it.id) ? items.map((x) => (x.id === it.id ? it : x)) : [...items, it])
    setEditing(null)
  }
  const blank = (): DocItem => ({ id: uid(), kind: 'service', description: '', qty: 1, unit: 'serv', unit_price: 0 })

  return (
    <div className="space-y-2">
      {items.length === 0 && <p className="text-sm text-slate-500">Nenhum item. Adicione serviços, peças ou materiais.</p>}
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {items.map((it, i) => (
          <li key={it.id} className="flex items-start gap-2 p-3">
            <button type="button" className="flex-1 text-left" onClick={() => setEditing(it)}>
              <div className="font-medium text-slate-900">{it.description || '(sem descrição)'}</div>
              <div className="text-xs text-slate-500">
                {KIND_LABEL[it.kind]}{it.region ? ` • ${it.region}` : ''} • {it.qty} {it.unit} × {money(it.unit_price)}
              </div>
            </button>
            <div className="text-right">
              <div className="font-semibold">{money(itemSubtotal(it))}</div>
              <div className="mt-1 flex gap-1">
                <button type="button" aria-label="Subir" disabled={i === 0} className="h-8 w-8 rounded text-slate-500 disabled:opacity-30" onClick={() => { const n = [...items]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n) }}>↑</button>
                <button type="button" aria-label="Remover" className="h-8 w-8 rounded text-red-600" onClick={() => onChange(items.filter((x) => x.id !== it.id))}>✕</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setEditing(blank())}>+ Item</Button>
        <Button variant="secondary" onClick={() => setCatalogOpen(true)}>+ Do catálogo</Button>
      </div>
      {editing && <ItemSheet item={editing} onClose={() => setEditing(null)} onSave={save} />}
      <CatalogPicker open={catalogOpen} onClose={() => setCatalogOpen(false)} onPick={(it) => { onChange([...items, it]); setCatalogOpen(false) }} />
    </div>
  )
}

function ItemSheet({ item, onClose, onSave }: { item: DocItem; onClose: () => void; onSave: (i: DocItem) => void }) {
  const [it, setIt] = useState(item)
  const set = <K extends keyof DocItem>(k: K, v: DocItem[K]) => setIt((x) => ({ ...x, [k]: v }))
  return (
    <Sheet open onClose={onClose} title="Item">
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(KIND_LABEL) as ItemKind[]).map((k) => (
          <button key={k} type="button" onClick={() => setIt((x) => ({ ...x, kind: k, unit: k === 'service' ? 'serv' : 'un' }))}
            className={`min-h-11 rounded-lg border text-sm font-semibold ${it.kind === k ? 'border-blue-700 bg-blue-50 text-blue-800' : 'border-slate-300'}`}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <Field label="Descrição *">
        <Input autoFocus value={it.description} onChange={(e) => set('description', e.target.value)} placeholder="Ex.: Pintura do para-choque" />
      </Field>
      <Field label="Peça / região do veículo">
        <Select value={it.region ?? ''} onChange={(e) => set('region', e.target.value || undefined)}>
          <option value="">—</option>
          {REGIONS.map((r) => <option key={r}>{r}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantidade">
          <Input inputMode="decimal" value={String(it.qty).replace('.', ',')} onChange={(e) => set('qty', Math.max(0, Number(e.target.value.replace(',', '.')) || 0))} />
        </Field>
        <Field label="Unidade">
          <Select value={it.unit} onChange={(e) => set('unit', e.target.value)}>
            {UNITS.map((u) => <option key={u}>{u}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Valor unitário">
        <MoneyInput value={it.unit_price} onChange={(v) => set('unit_price', v)} />
      </Field>
      <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2">
        <span className="text-sm">Subtotal</span>
        <strong>{money(itemSubtotal(it))}</strong>
      </div>
      <Button className="w-full" disabled={!it.description.trim()} onClick={() => onSave({ ...it, description: it.description.trim() })}>
        Salvar item
      </Button>
    </Sheet>
  )
}

function CatalogPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (i: DocItem) => void }) {
  const { data } = useLoad(() => (open ? db.list('catalog_items', { archived_at: null }) : Promise.resolve([])), [open])
  const [q, setQ] = useState('')
  const list = (data ?? []).filter((c) => `${c.description} ${c.region ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <Sheet open={open} onClose={onClose} title="Catálogo">
      <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar serviço ou peça" />
      {data && data.length === 0 && <p className="text-sm text-slate-500">Catálogo vazio. Cadastre serviços em Mais → Catálogo.</p>}
      <ul className="divide-y divide-slate-100">
        {list.map((c) => (
          <li key={c.id}>
            <button type="button" className="flex w-full items-center justify-between py-3 text-left active:bg-slate-50"
              onClick={() => onPick({ id: uid(), kind: c.kind, description: c.description, region: c.region, qty: 1, unit: c.unit, unit_price: c.price })}>
              <span>
                <span className="block font-medium">{c.description}</span>
                <span className="text-xs text-slate-500">{KIND_LABEL[c.kind]}{c.region ? ` • ${c.region}` : ''}</span>
              </span>
              <strong>{money(c.price)}</strong>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
