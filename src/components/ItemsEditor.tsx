import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLoad } from '../lib/app'
import { itemSubtotal } from '../lib/calc'
import { db } from '../lib/db'
import { REGIONS, UNITS } from '../lib/defaults'
import { money, uid } from '../lib/format'
import type { DocItem, ItemKind } from '../lib/types'
import { Button, Field, Input, MoneyInput, Select, Sheet } from './ui'

export const KIND_LABEL: Record<ItemKind, string> = { service: 'Mão de obra', part: 'Peça', material: 'Material' }

/** Sugestões: catálogo + serviços já usados em orçamentos/OS (com o último preço). */
function useSuggestions() {
  const { data } = useLoad(async () => {
    const [catalog, quotes, orders] = await Promise.all([db.list('catalog_items', { archived_at: null }), db.list('quotes'), db.list('work_orders')])
    const map = new Map<string, { description: string; price: number; kind: ItemKind; unit: string; region?: string }>()
    for (const d of [...quotes, ...orders].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)))
      for (const i of d.items) map.set(i.description.toLowerCase(), { description: i.description, price: i.unit_price, kind: i.kind, unit: i.unit, region: i.region })
    for (const c of catalog) map.set(c.description.toLowerCase(), { description: c.description, price: c.price, kind: c.kind, unit: c.unit, region: c.region })
    return [...map.values()]
  })
  return data ?? []
}

export function ItemsEditor({ items, onChange }: { items: DocItem[]; onChange: (items: DocItem[]) => void }) {
  const [editing, setEditing] = useState<DocItem | null>(null)
  const [desc, setDesc] = useState('')
  const [price, setPrice] = useState(0)
  const suggestions = useSuggestions()
  const byName = useMemo(() => new Map(suggestions.map((s) => [s.description.toLowerCase(), s])), [suggestions])

  const add = () => {
    const d = desc.trim()
    if (!d) return
    const sug = byName.get(d.toLowerCase())
    onChange([...items, { id: uid(), kind: sug?.kind ?? 'service', description: d, region: sug?.region, qty: 1, unit: sug?.unit ?? 'serv', unit_price: price }])
    setDesc('')
    setPrice(0)
  }
  const save = (it: DocItem) => {
    onChange(items.map((x) => (x.id === it.id ? it : x)))
    setEditing(null)
  }

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl ring-1 ring-slate-200">
          {items.map((it) => (
            <li key={it.id}>
              <button type="button" className="flex w-full items-center gap-3 bg-white px-3.5 py-3 text-left active:bg-slate-50" onClick={() => setEditing(it)}>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug">{it.description}</span>
                  {(it.qty !== 1 || it.region) && (
                    <span className="block text-xs text-slate-500">{[it.region, it.qty !== 1 ? `${String(it.qty).replace('.', ',')} ${it.unit} × ${money(it.unit_price)}` : ''].filter(Boolean).join(' • ')}</span>
                  )}
                </span>
                <span className="tnum font-bold">{money(itemSubtotal(it))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <div className="grid grid-cols-[1fr_8.5rem] gap-2">
          <Input
            aria-label="Serviço ou peça"
            list="item-suggestions"
            value={desc}
            onChange={(e) => {
              setDesc(e.target.value)
              const s = byName.get(e.target.value.toLowerCase())
              if (s) setPrice(s.price)
            }}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder={items.length ? 'Outro serviço ou peça' : 'Ex.: Pintura do para-choque'}
          />
          <MoneyInput aria-label="Valor do item" value={price} onChange={setPrice} onKeyDown={(e) => e.key === 'Enter' && add()} />
        </div>
        <Button className="mt-2 w-full" variant="secondary" icon={Plus} disabled={!desc.trim()} onClick={add}>Adicionar</Button>
        <datalist id="item-suggestions">
          {suggestions.map((s) => <option key={s.description} value={s.description}>{money(s.price)}</option>)}
        </datalist>
      </div>
      {editing && <ItemSheet item={editing} onClose={() => setEditing(null)} onSave={save} onRemove={() => { onChange(items.filter((x) => x.id !== editing.id)); setEditing(null) }} />}
    </div>
  )
}

function ItemSheet({ item, onClose, onSave, onRemove }: { item: DocItem; onClose: () => void; onSave: (i: DocItem) => void; onRemove: () => void }) {
  const [it, setIt] = useState(item)
  const set = <K extends keyof DocItem>(k: K, v: DocItem[K]) => setIt((x) => ({ ...x, [k]: v }))
  return (
    <Sheet open onClose={onClose} title="Editar item">
      <Field label="Descrição">
        <Input value={it.description} onChange={(e) => set('description', e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantidade">
          <Input inputMode="decimal" value={String(it.qty).replace('.', ',')} onChange={(e) => set('qty', Math.max(0, Number(e.target.value.replace(',', '.')) || 0))} />
        </Field>
        <Field label="Valor unitário">
          <MoneyInput value={it.unit_price} onChange={(v) => set('unit_price', v)} />
        </Field>
      </div>
      <details className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
        <summary className="cursor-pointer text-sm font-semibold text-slate-600">Tipo, unidade e peça do carro</summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(KIND_LABEL) as ItemKind[]).map((k) => (
              <button key={k} type="button" onClick={() => set('kind', k)}
                className={`min-h-11 rounded-xl text-sm font-semibold ring-1 ${it.kind === k ? 'bg-brand-50 text-brand-700 ring-brand-500' : 'bg-white ring-slate-200'}`}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Unidade">
              <Select value={it.unit} onChange={(e) => set('unit', e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select>
            </Field>
            <Field label="Peça do carro">
              <Select value={it.region ?? ''} onChange={(e) => set('region', e.target.value || undefined)}>
                <option value="">—</option>
                {REGIONS.map((r) => <option key={r}>{r}</option>)}
              </Select>
            </Field>
          </div>
        </div>
      </details>
      <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 text-brand-800">
        <span className="text-sm font-semibold">Subtotal</span>
        <strong className="tnum text-lg">{money(itemSubtotal(it))}</strong>
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Button variant="danger" icon={Trash2} onClick={onRemove} aria-label="Remover item" />
        <Button disabled={!it.description.trim()} onClick={() => onSave({ ...it, description: it.description.trim() })}>Salvar item</Button>
      </div>
    </Sheet>
  )
}
