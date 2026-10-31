import { askConfirm } from '../lib/confirm'
import { AtSign, Check, Clock, MapPin, MessageSquareText, Phone } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQr, WaIcon } from '../components/ShareBox'
import { usePhotoUrl } from '../components/PhotoManager'
import type { PublicRaw } from '../lib/backend'
import { installments, insuranceSplit } from '../lib/calc'
import { db } from '../lib/db'
import { PAYMENT_METHODS, QUOTE_STATUS } from '../lib/defaults'
import { date, dateTime, maskedPlate, money, phone, today } from '../lib/format'
import { pixPayload } from '../lib/pix'
import { companyAddress, copyText, whatsappUrl } from '../lib/share'

/** Página pública do cliente (sem login). Atualiza sozinha a cada 30 s. */
export default function PublicPortal() {
  const { token } = useParams() as { token: string }
  const [raw, setRaw] = useState<PublicRaw | null | undefined>(undefined)
  const load = useCallback(() => db.publicDocument(token).then(setRaw).catch(() => setRaw((r) => r ?? null)), [token])

  useEffect(() => {
    load()
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 30000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (raw) document.title = `${raw.company.trade_name ?? 'Oficina'} • ${raw.doc.number}`
  }, [raw])

  if (raw === undefined) return <div className="p-10 text-center text-slate-500">Carregando…</div>
  if (raw === null)
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-bold">Link indisponível</h1>
        <p className="mt-2 text-slate-600">Este link expirou ou foi desativado. Fale com a oficina para receber um novo.</p>
      </div>
    )
  return <Portal raw={raw} token={token} reload={load} />
}

function Portal({ raw, token, reload }: { raw: PublicRaw; token: string; reload: () => void }) {
  const nav = useNavigate()
  const c = raw.company
  const d = raw.doc
  const color = c.brand_color || '#1d4ed8'
  const logo = usePhotoUrl(c.logo_url, token)
  const isQuote = raw.kind === 'quote'
  const stages = (c.stages ?? []).filter((s) => s.public)
  const curIdx = stages.findIndex((s) => s.key === d.stage)
  const split = insuranceSplit(d.total, d.insurance)
  const due = Math.max(0, split.customer - raw.paid)
  const showValues = isQuote || c.show_values_on_portal !== false
  const veh = [raw.vehicle.brand, raw.vehicle.model, raw.vehicle.color].filter(Boolean).join(' ')
  const wa = c.whatsapp || c.phone

  return (
    <div className="mx-auto min-h-dvh max-w-xl bg-page pb-10">
      {import.meta.env.VITE_DEMO && (
        <button type="button" onClick={() => nav(-1)} className="w-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
          Demonstração: esta é a página que o cliente vê. Toque aqui para voltar ao sistema.
        </button>
      )}
      <header className="px-4 pb-8 pt-5 text-white" style={{ background: `linear-gradient(160deg, ${color}, ${color}dd)` }}>
        <div className="flex items-center gap-3">
          {logo && <img src={logo} alt="" className="h-14 w-14 rounded-lg bg-card object-contain p-1" />}
          <div>
            <div className="text-lg font-extrabold leading-tight">{c.trade_name}</div>
            {c.tagline && <div className="text-sm opacity-90">{c.tagline}</div>}
          </div>
        </div>
        <div className="mt-4 text-sm opacity-90">Olá{raw.customer_name ? `, ${raw.customer_name}` : ''}!</div>
        <div className="text-2xl font-extrabold tracking-tight">{isQuote ? 'Seu orçamento' : 'Acompanhe seu carro'}</div>
        <div className="text-sm opacity-80">{isQuote ? 'Orçamento' : 'Serviço'} nº {d.number}</div>
        <div className="text-sm opacity-90">{veh} • {maskedPlate(raw.vehicle.plate)}</div>
      </header>

      <main className="-mt-4 space-y-3 px-3">
        {isQuote ? <QuoteStatusCard raw={raw} token={token} reload={reload} /> : (
          <div className="rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(19,32,58,0.06)] ring-1 ring-slate-200/70">
            <div className="text-xs font-semibold uppercase text-slate-500">Etapa atual</div>
            <div className="text-xl font-bold" style={{ color }}>{stages[curIdx]?.name ?? '—'}</div>
            <div className="mt-2 flex gap-1">{stages.map((s, i) => <div key={s.key} className="h-2 flex-1 rounded" style={{ background: i <= curIdx ? color : 'var(--color-slate-200)' }} />)}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><div className="text-slate-500">Entrada</div><strong>{date(d.entry_date)}</strong></div>
              <div><div className="text-slate-500">{d.delivered_at ? 'Entregue em' : 'Previsão de entrega'}</div><strong>{d.delivered_at ? date(d.delivered_at) : date(d.due_date)}</strong></div>
            </div>
            {d.public_note && <p className="mt-3 flex gap-2 rounded-xl bg-slate-50 p-3 text-sm"><MessageSquareText size={18} className="shrink-0" style={{ color }} /> {d.public_note}</p>}
          </div>
        )}

        {!isQuote && (
          <div className="rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(19,32,58,0.06)] ring-1 ring-slate-200/70">
            <h2 className="mb-3 text-base font-extrabold">Andamento</h2>
            <ol className="space-y-3">
              {stages.map((s, i) => {
                const ev = [...raw.events].reverse().find((e) => e.stage === s.key)
                const done = i < curIdx
                const cur = i === curIdx
                return (
                  <li key={s.key} className="flex gap-3">
                    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done || cur ? 'text-white' : 'bg-slate-200 text-slate-500'}`} style={done || cur ? { background: color } : {}}>
                      {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                    </span>
                    <div className={`text-sm ${!done && !cur ? 'text-slate-400' : ''}`}>
                      <div className={cur ? 'font-bold' : 'font-medium'}>{s.name}</div>
                      {ev && (done || cur) && <div className="text-xs text-slate-500">{dateTime(ev.created_at)}</div>}
                      {ev?.note && (done || cur) && <div className="text-xs text-slate-600">{ev.note}</div>}
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        {raw.photos.length > 0 && <Gallery photos={raw.photos} token={token} stages={c.stages ?? []} />}

        <div className="rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(19,32,58,0.06)] ring-1 ring-slate-200/70">
          <h2 className="mb-2 text-base font-extrabold">Serviços</h2>
          {d.simple ? <p className="whitespace-pre-wrap text-sm">{d.simple_description}</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {d.items.map((i, k) => (
                <li key={k} className="flex justify-between gap-2 py-2">
                  <span>{i.description}{i.region ? <span className="block text-xs text-slate-500">{i.region}</span> : null}</span>
                  {showValues && <span>{money(Math.round(i.qty * i.unit_price))}</span>}
                </li>
              ))}
            </ul>
          )}
          {showValues && (
            <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-sm">
              {d.discount > 0 && <div className="flex justify-between"><span>Desconto</span><span>− {money(d.discount)}</span></div>}
              <div className="flex justify-between text-base font-bold"><span>Total</span><span>{money(d.total)}</span></div>
              {d.insurance && <div className="flex justify-between"><span>Seguradora ({d.insurance.insurer})</span><span>{money(split.insurer)}</span></div>}
              {d.insurance && <div className="flex justify-between font-semibold"><span>Sua parte (franquia)</span><span>{money(split.customer)}</span></div>}
              {!isQuote && raw.paid > 0 && <div className="flex justify-between"><span>Já pago</span><span>{money(raw.paid)}</span></div>}
              {!isQuote && <div className="flex justify-between font-semibold"><span>Saldo</span><span>{money(due)}</span></div>}
            </div>
          )}
          {d.customer_notes && <p className="mt-3 text-sm text-slate-700">{d.customer_notes}</p>}
        </div>

        {showValues && <PaymentCard raw={raw} amount={isQuote ? split.customer : due} />}

        {d.delivered_at && c.warranty_terms && (
          <div className="rounded-2xl bg-card p-4 text-sm shadow-[0_1px_2px_rgba(19,32,58,0.06)] ring-1 ring-slate-200/70"><h2 className="mb-1 font-bold">Garantia</h2>{c.warranty_terms}</div>
        )}

        <div className="rounded-2xl bg-card p-4 text-sm shadow-[0_1px_2px_rgba(19,32,58,0.06)] ring-1 ring-slate-200/70">
          <h2 className="mb-2 text-base font-extrabold">Fale com a oficina</h2>
          {wa && <a href={whatsappUrl(wa, `Olá! Sobre ${isQuote ? 'o orçamento' : 'a OS'} ${d.number}:`)} className="mb-3 flex min-h-13 items-center justify-center gap-2 rounded-xl bg-wa font-bold text-white"><WaIcon size={22} /> Chamar no WhatsApp</a>}
          <div className="space-y-2 text-slate-600">
            {c.phone && <div className="flex gap-2"><Phone size={17} className="shrink-0 text-slate-400" /> <a className="font-semibold text-brand-700" href={`tel:${c.phone}`}>{phone(c.phone)}</a></div>}
            {companyAddress(c) && <div className="flex gap-2"><MapPin size={17} className="shrink-0 text-slate-400" /> {companyAddress(c)}</div>}
            {c.opening_hours && <div className="flex gap-2"><Clock size={17} className="shrink-0 text-slate-400" /> {c.opening_hours}</div>}
            {c.instagram && <div className="flex gap-2"><AtSign size={17} className="shrink-0 text-slate-400" /> {c.instagram.replace(/^@/, '')}</div>}
          </div>
        </div>
        <p className="text-center text-xs text-slate-400">Esta página é atualizada automaticamente.</p>
      </main>
    </div>
  )
}

function QuoteStatusCard({ raw, token, reload }: { raw: PublicRaw; token: string; reload: () => void }) {
  const d = raw.doc
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const expired = !!d.valid_until && d.valid_until < today()
  const open = ['rascunho', 'enviado'].includes(d.status ?? '') && !expired
  const st = QUOTE_STATUS[(expired && open ? 'expirado' : d.status) as keyof typeof QUOTE_STATUS] ?? QUOTE_STATUS.enviado

  async function decide(approve: boolean) {
    if (name.trim().length < 2) return setErr('Informe seu nome')
    if (!approve && !(await askConfirm('Recusar este orçamento?', 'Recusar'))) return
    setBusy(true)
    try {
      await db.publicDecision(token, approve, name.trim(), note.trim())
      reload()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(19,32,58,0.06)] ring-1 ring-slate-200/70">
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${st.cls}`}>{expired && open ? 'Expirado' : d.status === 'enviado' || d.status === 'rascunho' ? 'Aguardando sua aprovação' : st.label}</span>
        <span className="text-sm text-slate-500">Válido até {date(d.valid_until)}</span>
      </div>
      {d.estimated_days ? <p className="mt-2 text-sm">Prazo estimado: <strong>{d.estimated_days} dias</strong> após a aprovação.</p> : null}
      {d.decision_at && <p className="mt-2 text-sm">Respondido por {d.decision_by} em {dateTime(d.decision_at)}.</p>}
      {open && (
        <div className="mt-3 space-y-2">
          <input className="block min-h-12 w-full rounded-xl px-3.5 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Seu nome completo" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea className="block w-full rounded-xl px-3.5 py-3 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500" rows={2} placeholder="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          {err && <p className="text-sm text-red-700">{err}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button disabled={busy} className="min-h-13 rounded-xl font-semibold ring-1 ring-slate-200" onClick={() => decide(false)}>Recusar</button>
            <button disabled={busy} className="min-h-13 rounded-xl bg-emerald-600 font-bold text-white shadow-sm" onClick={() => decide(true)}>Aprovar orçamento</button>
          </div>
        </div>
      )}
    </div>
  )
}

function PaymentCard({ raw, amount }: { raw: PublicRaw; amount: number }) {
  const c = raw.company
  const t = raw.doc.payment_terms
  const [copied, setCopied] = useState(false)
  const payload = t.methods.includes('pix') && c.pix_key && amount > 0 ? pixPayload({ key: c.pix_key, name: c.pix_name || c.trade_name || '', city: c.city || '', amountCents: amount, txid: raw.doc.number.replace(/\W/g, '') }) : ''
  const qr = useQr(t.show_pix_qr ? payload : '', 360)
  const financed = Math.max(0, amount - t.down_payment)
  const inst = installments(financed, t.installments, t.installments > 1 ? c.installment_fee_percent ?? 0 : 0)
  if (!t.methods.length && !payload) return null
  return (
    <div className="rounded-2xl bg-card p-4 text-sm shadow-[0_1px_2px_rgba(19,32,58,0.06)] ring-1 ring-slate-200/70">
      <h2 className="mb-2 text-base font-extrabold">Pagamento</h2>
      <p>{t.methods.map((m) => PAYMENT_METHODS[m]).join(' • ')}</p>
      {t.down_payment > 0 && <p>Entrada: <strong>{money(t.down_payment)}</strong></p>}
      {t.installments > 1 && financed > 0 && <p>Parcelado em <strong>{t.installments}x de {money(inst.values[0])}</strong></p>}
      {t.notes && <p>{t.notes}</p>}
      {payload && (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-lg bg-slate-50 p-3">
          {qr && <img src={qr} alt="QR Code PIX" className="h-44 w-44" />}
          <div className="text-center">PIX de <strong>{money(amount)}</strong><br /><span className="text-xs text-slate-500">Chave: {c.pix_key}</span></div>
          <button className="min-h-12 w-full rounded-xl bg-card font-semibold ring-1 ring-slate-200" onClick={async () => setCopied(await copyText(payload))}>
            {copied ? 'Código copiado ✓' : 'Copiar PIX copia e cola'}
          </button>
        </div>
      )}
    </div>
  )
}

function Gallery({ photos, token, stages }: { photos: PublicRaw['photos']; token: string; stages: { key: string; name: string }[] }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(19,32,58,0.06)] ring-1 ring-slate-200/70">
      <h2 className="mb-2 text-base font-extrabold">Fotos</h2>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => <PubThumb key={p.path} path={p.path} token={token} label={p.caption || stages.find((s) => s.key === p.stage)?.name} onClick={() => setOpen(p.path)} />)}
      </div>
      {open && <Lightbox path={open} token={token} onClose={() => setOpen(null)} />}
    </div>
  )
}

function PubThumb({ path, token, label, onClick }: { path: string; token: string; label?: string; onClick: () => void }) {
  const url = usePhotoUrl(path, token)
  return (
    <button type="button" onClick={onClick} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
      {url && <img src={url} alt={label ?? ''} loading="lazy" className="h-full w-full object-cover" />}
      {label && <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 text-[10px] text-white">{label}</span>}
    </button>
  )
}

function Lightbox({ path, token, onClose }: { path: string; token: string; onClose: () => void }) {
  const url = usePhotoUrl(path, token)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
      {url && <img src={url} alt="" className="max-h-full max-w-full object-contain" />}
      <button className="absolute right-3 top-3 h-11 w-11 rounded-full bg-card/20 text-2xl text-white" aria-label="Fechar">×</button>
    </div>
  )
}
