import { PenLine } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { CHECKLIST_ITEMS, DAMAGE_TYPES } from '../lib/defaults'
import { digits } from '../lib/format'
import type { Checklist, DamageType } from '../lib/types'
import { Button, Field, Input, Sheet, TextArea } from './ui'

// Vista de cima, frente para cima. Esquerda do desenho = lado esquerdo (motorista).
const SHAPES: { region: string; x: number; y: number; w: number; h: number; rx?: number }[] = [
  { region: 'Para-choque dianteiro', x: 40, y: 8, w: 120, h: 26, rx: 12 },
  { region: 'Capô', x: 52, y: 38, w: 96, h: 72, rx: 6 },
  { region: 'Para-lama diant. esq.', x: 20, y: 38, w: 28, h: 72, rx: 6 },
  { region: 'Para-lama diant. dir.', x: 152, y: 38, w: 28, h: 72, rx: 6 },
  { region: 'Vidros', x: 52, y: 114, w: 96, h: 24, rx: 4 },
  { region: 'Retrovisor esq.', x: 2, y: 116, w: 16, h: 14, rx: 4 },
  { region: 'Retrovisor dir.', x: 182, y: 116, w: 16, h: 14, rx: 4 },
  { region: 'Porta diant. esq.', x: 20, y: 114, w: 28, h: 72, rx: 4 },
  { region: 'Porta diant. dir.', x: 152, y: 114, w: 28, h: 72, rx: 4 },
  { region: 'Teto', x: 52, y: 142, w: 96, h: 108, rx: 6 },
  { region: 'Porta tras. esq.', x: 20, y: 190, w: 28, h: 72, rx: 4 },
  { region: 'Porta tras. dir.', x: 152, y: 190, w: 28, h: 72, rx: 4 },
  { region: 'Lateral tras. esq.', x: 20, y: 266, w: 28, h: 70, rx: 6 },
  { region: 'Lateral tras. dir.', x: 152, y: 266, w: 28, h: 70, rx: 6 },
  { region: 'Tampa traseira', x: 52, y: 254, w: 96, h: 82, rx: 6 },
  { region: 'Para-choque traseiro', x: 40, y: 340, w: 120, h: 26, rx: 12 },
]

export function CarDiagram({ damages, onTap, small }: { damages: Checklist['damages']; onTap?: (region: string) => void; small?: boolean }) {
  return (
    <svg viewBox="0 0 200 374" className={small ? 'h-56 w-auto' : 'mx-auto h-[360px] w-auto max-w-full'} role="img" aria-label="Diagrama do veículo">
      {SHAPES.map((s) => {
        const n = damages.filter((d) => d.region === s.region).length
        return (
          <g key={s.region} onClick={() => onTap?.(s.region)} style={{ cursor: onTap ? 'pointer' : 'default' }}>
            <title>{s.region}</title>
            <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={n ? '#fecaca' : '#f1f5f9'} stroke={n ? '#dc2626' : '#94a3b8'} strokeWidth={n ? 2 : 1} />
            {n > 0 && (
              <>
                <circle cx={s.x + s.w / 2} cy={s.y + s.h / 2} r={9} fill="#dc2626" />
                <text x={s.x + s.w / 2} y={s.y + s.h / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{n}</text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

const FUEL = ['Vazio', '1/4', '1/2', '3/4', 'Cheio']

export function ChecklistEditor({ value, onChange }: { value: Checklist; onChange: (c: Checklist) => void }) {
  const [region, setRegion] = useState<string | null>(null)
  const set = <K extends keyof Checklist>(k: K, v: Checklist[K]) => onChange({ ...value, [k]: v })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Km na entrada">
          <Input inputMode="numeric" value={value.km ?? ''} onChange={(e) => set('km', e.target.value ? Number(digits(e.target.value)) : null)} />
        </Field>
        <Field label="Combustível">
          <div className="flex gap-1">
            {FUEL.map((f, i) => (
              <button key={f} type="button" onClick={() => set('fuel', i)}
                className={`min-h-11 flex-1 rounded border text-xs font-semibold ${value.fuel === i ? 'border-brand-700 bg-brand-700 text-white' : 'border-slate-300'}`}>
                {f}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">Avarias existentes — toque na parte do carro</p>
        <div className="rounded-lg border border-slate-200 bg-card py-2">
          <p className="text-center text-xs text-slate-500">▲ frente</p>
          <CarDiagram damages={value.damages} onTap={setRegion} />
        </div>
        {value.damages.length > 0 && (
          <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
            {value.damages.map((d, i) => (
              <li key={i} className="flex items-center justify-between px-3 py-2">
                <span><strong>{d.region}</strong> — {DAMAGE_TYPES[d.type]}{d.note ? ` (${d.note})` : ''}</span>
                <button type="button" className="h-8 w-8 text-red-600" aria-label="Remover" onClick={() => set('damages', value.damages.filter((_, j) => j !== i))}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">Itens no veículo</p>
        <div className="flex flex-wrap gap-2">
          {CHECKLIST_ITEMS.map((it) => {
            const on = value.items.includes(it)
            return (
              <button key={it} type="button" onClick={() => set('items', on ? value.items.filter((x) => x !== it) : [...value.items, it])}
                className={`min-h-10 rounded-full border px-3 text-sm ${on ? 'border-green-700 bg-green-50 font-semibold text-green-800' : 'border-slate-300'}`}>
                {on ? '✓ ' : ''}{it}
              </button>
            )
          })}
        </div>
      </div>

      <Field label="Objetos pessoais deixados no carro">
        <Input value={value.belongings ?? ''} onChange={(e) => set('belongings', e.target.value)} placeholder="Ex.: cadeirinha, óculos no porta-luvas" />
      </Field>
      <Field label="Observações da entrada">
        <TextArea rows={2} value={value.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
      </Field>

      <SignatureField
        label="Assinatura do cliente (opcional)"
        value={value.signature}
        name={value.signed_by}
        onChange={(signature, signed_by) => onChange({ ...value, signature, signed_by, signed_at: signature ? new Date().toISOString() : undefined })}
      />

      {region && <DamageSheet region={region} onClose={() => setRegion(null)} onAdd={(type, note) => { set('damages', [...value.damages, { region, type, note }]); setRegion(null) }} />}
    </div>
  )
}

function DamageSheet({ region, onClose, onAdd }: { region: string; onClose: () => void; onAdd: (t: DamageType, note: string) => void }) {
  const [note, setNote] = useState('')
  return (
    <Sheet open onClose={onClose} title={region}>
      <Field label="Observação (opcional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(DAMAGE_TYPES) as DamageType[]).map((t) => (
          <Button key={t} variant="secondary" onClick={() => onAdd(t, note.trim())}>{DAMAGE_TYPES[t]}</Button>
        ))}
      </div>
    </Sheet>
  )
}

export function SignatureField({ label, value, name, onChange }: { label: string; value?: string | null; name?: string; onChange: (dataUrl: string | undefined, name: string | undefined) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-slate-700">{label}</p>
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-card p-2">
          <img src={value} alt="Assinatura" className="h-16 flex-1 object-contain" />
          <div className="text-right text-sm">
            <div>{name}</div>
            <button type="button" className="font-semibold text-red-700" onClick={() => onChange(undefined, undefined)}>Apagar</button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" icon={PenLine} className="w-full" onClick={() => setOpen(true)}>Colher assinatura</Button>
      )}
      {open && <SignatureSheet onClose={() => setOpen(false)} onSave={(d, n) => { onChange(d, n); setOpen(false) }} />}
    </div>
  )
}

function SignatureSheet({ onClose, onSave }: { onClose: () => void; onSave: (dataUrl: string, name: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [name, setName] = useState('')
  const [drawn, setDrawn] = useState(false)

  useEffect(() => {
    const c = ref.current!
    const ratio = window.devicePixelRatio || 1
    c.width = c.clientWidth * ratio
    c.height = c.clientHeight * ratio
    const ctx = c.getContext('2d')!
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#0f172a'
    let drawing = false
    const pos = (e: PointerEvent) => {
      const r = c.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top] as const
    }
    const down = (e: PointerEvent) => {
      drawing = true
      c.setPointerCapture(e.pointerId)
      const [x, y] = pos(e)
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
    const move = (e: PointerEvent) => {
      if (!drawing) return
      const [x, y] = pos(e)
      ctx.lineTo(x, y)
      ctx.stroke()
      setDrawn(true)
    }
    const up = () => (drawing = false)
    c.addEventListener('pointerdown', down)
    c.addEventListener('pointermove', move)
    c.addEventListener('pointerup', up)
    return () => {
      c.removeEventListener('pointerdown', down)
      c.removeEventListener('pointermove', move)
      c.removeEventListener('pointerup', up)
    }
  }, [])

  const clear = () => {
    const c = ref.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setDrawn(false)
  }

  return (
    <Sheet open onClose={onClose} title="Assinatura">
      <Field label="Nome de quem assina">
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <canvas ref={ref} className="h-48 w-full touch-none rounded-lg border-2 border-dashed border-slate-300 bg-card" />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={clear}>Limpar</Button>
        <Button disabled={!drawn || name.trim().length < 2} onClick={() => onSave(ref.current!.toDataURL('image/png'), name.trim())}>Confirmar</Button>
      </div>
    </Sheet>
  )
}

export const emptyChecklist = (km?: number | null): Checklist => ({ km: km ?? null, fuel: 2, damages: [], items: [] })
