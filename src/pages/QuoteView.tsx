import { Archive, ArchiveRestore, Camera, CheckCircle2, Copy, FileDown, ListChecks, MoreHorizontal, Pencil, RefreshCw, Wrench } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DocHero, ItemsSummary } from '../components/DocSummary'
import { PhotoManager } from '../components/PhotoManager'
import { ShareBox, WaIcon } from '../components/ShareBox'
import { Badge, Button, Collapsible, ErrorBox, LinkButton, Loading, PageHeader, Section } from '../components/ui'
import { useAction, useApp, useLoad } from '../lib/app'
import { askConfirm } from '../lib/confirm'
import { db } from '../lib/db'
import { QUOTE_STATUS } from '../lib/defaults'
import { convertToWorkOrder, duplicateQuote, isQuoteExpired, snapshot } from '../lib/docs'
import { addDays, date, dateTime, randomToken, today } from '../lib/format'
import { fillTemplate, messageVars } from '../lib/share'
import type { QuoteStatus } from '../lib/types'

export default function QuoteView() {
  const { id } = useParams()
  const nav = useNavigate()
  const { settings, session } = useApp()
  const { busy, run } = useAction()
  const [share, setShare] = useState(false)
  const { data, error } = useLoad(async () => {
    const q = await db.get('quotes', id!)
    if (!q) throw new Error('Orçamento não encontrado')
    const [customer, vehicle] = await Promise.all([db.get('customers', q.customer_id), db.get('vehicles', q.vehicle_id)])
    return { q, customer, vehicle }
  }, [id])

  if (error) return <ErrorBox message={error} />
  if (!data || !settings) return <Loading />
  const { q, customer, vehicle } = data
  const expired = isQuoteExpired(q)
  const st = QUOTE_STATUS[expired ? 'expirado' : q.status]
  const message = fillTemplate(settings.templates.quote, messageVars({ customer, vehicle, number: q.number, token: q.public_token }))
  const canConvert = !q.work_order_id && !['recusado', 'cancelado'].includes(q.status)

  const setStatus = (status: QuoteStatus) =>
    run(() => db.update('quotes', q.id, { status, company_snapshot: status !== 'rascunho' ? q.company_snapshot ?? snapshot(settings) : q.company_snapshot }), 'Situação atualizada')

  async function convert() {
    if (q.status !== 'aprovado' && !(await askConfirm('O cliente ainda não aprovou. Abrir o serviço mesmo assim?', 'Abrir serviço'))) return
    const wo = await run(() => convertToWorkOrder(q, session!.organizationId!, settings!), 'Serviço aberto')
    if (wo) nav(`/os/${wo.id}`)
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`Orçamento ${q.number.split('-').pop()}`} subtitle={`${q.number} • ${date(q.created_at)}`} back="/orcamentos" actions={<Badge className={st.cls}>{st.label}</Badge>} />
      {q.archived_at && <ErrorBox message="Este orçamento está arquivado." />}

      <DocHero customer={customer} vehicle={vehicle} total={q.total} label={q.insurance ? 'Total (com seguradora)' : 'Total'}
        extra={q.decision_at ? (
          <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${q.status === 'aprovado' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
            <CheckCircle2 size={18} /> {q.status === 'aprovado' ? 'Aprovado' : 'Respondido'} por {q.decision_by} em {dateTime(q.decision_at)}
          </div>
        ) : q.last_viewed_at ? <p className="text-xs text-slate-500">O cliente abriu o link em {dateTime(q.last_viewed_at)}</p> : null}
      />

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button variant="whatsapp" className="min-h-14 text-base" onClick={() => setShare(true)}><WaIcon size={22} /> Enviar ao cliente</Button>
        <LinkButton to={`/imprimir/quote/${q.id}`} variant="secondary" icon={FileDown} className="min-h-14">PDF</LinkButton>
      </div>

      {q.work_order_id ? (
        <LinkButton to={`/os/${q.work_order_id}`} variant="secondary" icon={Wrench} className="w-full">Ver serviço em andamento</LinkButton>
      ) : canConvert && (
        <Button className="min-h-14 w-full text-base" icon={Wrench} disabled={busy} onClick={convert}>
          {q.status === 'aprovado' ? 'Cliente aprovou — abrir serviço' : 'Aprovado? Abrir serviço'}
        </Button>
      )}

      {expired && (
        <Button variant="secondary" icon={RefreshCw} className="w-full" onClick={() => run(() => db.update('quotes', q.id, { valid_until: addDays(today(), settings.quote_validity_days), status: 'enviado' }), 'Validade renovada')}>
          Venceu em {date(q.valid_until)} — renovar
        </Button>
      )}

      <Section title="Serviços" icon={ListChecks} right={<LinkButton to={`/orcamentos/${q.id}/editar`} variant="ghost" icon={Pencil} className="min-h-10 px-2">Editar</LinkButton>}>
        <ItemsSummary doc={q} />
        {q.customer_notes && <p className="rounded-xl bg-slate-50 p-3 text-sm">{q.customer_notes}</p>}
        {q.internal_notes && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><strong>Só você vê:</strong> {q.internal_notes}</p>}
      </Section>

      <Section title="Fotos" icon={Camera}>
        <PhotoManager parentType="quote" parentId={q.id} vehicleId={q.vehicle_id} />
      </Section>

      <Collapsible title="Mais ações" icon={MoreHorizontal} subtitle="Mudar situação, duplicar, arquivar">
        <p className="text-sm text-slate-500">Válido até {date(q.valid_until)}{q.estimated_days ? ` • prazo de ${q.estimated_days} dias` : ''}</p>
        <div className="grid grid-cols-2 gap-2">
          {(['enviado', 'aprovado', 'recusado', 'cancelado'] as QuoteStatus[])
            .filter((s) => s !== q.status && (!q.work_order_id || s === 'aprovado'))
            .map((s) => <Button key={s} variant="secondary" onClick={() => setStatus(s)}>{QUOTE_STATUS[s].label}</Button>)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" icon={Copy} disabled={busy} onClick={async () => { const c = await run(() => duplicateQuote(q, session!.organizationId!, settings), 'Orçamento duplicado'); if (c) nav(`/orcamentos/${c.id}`) }}>Duplicar</Button>
          {q.archived_at ? (
            <Button variant="secondary" icon={ArchiveRestore} onClick={() => run(() => db.update('quotes', q.id, { archived_at: null }), 'Restaurado')}>Restaurar</Button>
          ) : (
            <Button variant="danger" icon={Archive} onClick={async () => (await askConfirm('Arquivar este orçamento? Você pode restaurar depois.', 'Arquivar')) && run(() => db.update('quotes', q.id, { archived_at: new Date().toISOString() }), 'Arquivado').then(() => nav('/orcamentos'))}>Arquivar</Button>
          )}
        </div>
      </Collapsible>

      <ShareBox
        open={share}
        onClose={() => setShare(false)}
        token={q.public_token}
        enabled={q.public_enabled}
        lastViewed={q.last_viewed_at}
        phone={customer?.whatsapp || customer?.phone}
        message={message}
        onToggle={(enabled) => run(() => db.update('quotes', q.id, { public_enabled: enabled }))}
        onRegenerate={() => run(() => db.update('quotes', q.id, { public_token: randomToken() }), 'Novo link gerado')}
        onSent={() => q.status === 'rascunho' && setStatus('enviado')}
      />
    </div>
  )
}
