import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ItemsSummary, PartiesCard } from '../components/DocSummary'
import { PhotoManager } from '../components/PhotoManager'
import { ShareBox } from '../components/ShareBox'
import { Badge, Button, Card, ErrorBox, LinkButton, Loading, PageHeader, Section } from '../components/ui'
import { useAction, useApp, useLoad } from '../lib/app'
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

  const setStatus = (status: QuoteStatus) =>
    run(() => db.update('quotes', q.id, { status, company_snapshot: status !== 'rascunho' ? q.company_snapshot ?? snapshot(settings) : q.company_snapshot }), 'Situação atualizada')

  return (
    <div className="space-y-4">
      <PageHeader title={q.number} back="/orcamentos" actions={<Badge className={st.cls}>{st.label}</Badge>} />
      {q.archived_at && <ErrorBox message="Este orçamento está arquivado." />}
      <PartiesCard customer={customer} vehicle={vehicle} />

      <div className="grid grid-cols-2 gap-2">
        <Button variant="success" onClick={() => setShare(true)}>WhatsApp / Link</Button>
        <LinkButton to={`/imprimir/quote/${q.id}`} variant="secondary">Imprimir / PDF</LinkButton>
      </div>

      {q.work_order_id ? (
        <LinkButton to={`/os/${q.work_order_id}`} variant="secondary" className="w-full">Ver ordem de serviço →</LinkButton>
      ) : (
        !['recusado', 'cancelado'].includes(q.status) && (
          <Button className="w-full" disabled={busy} onClick={async () => {
            if (q.status !== 'aprovado' && !confirm('O orçamento ainda não está aprovado. Transformar em OS mesmo assim?')) return
            const wo = await run(() => convertToWorkOrder(q, session!.organizationId!, settings), 'Ordem de serviço criada')
            if (wo) nav(`/os/${wo.id}`)
          }}>
            Transformar em ordem de serviço
          </Button>
        )
      )}

      <Card className="space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-slate-600">Criado em</span><span>{date(q.created_at)}</span></div>
        <div className="flex justify-between"><span className="text-slate-600">Válido até</span><span className={expired ? 'font-semibold text-orange-700' : ''}>{date(q.valid_until)}</span></div>
        {q.estimated_days ? <div className="flex justify-between"><span className="text-slate-600">Prazo estimado</span><span>{q.estimated_days} dias</span></div> : null}
        {q.decision_at && (
          <div className="flex justify-between"><span className="text-slate-600">{q.status === 'aprovado' ? 'Aprovado' : 'Respondido'} por</span><span>{q.decision_by} em {dateTime(q.decision_at)}</span></div>
        )}
        {q.decision_note && <p className="text-slate-700">Obs. do cliente: {q.decision_note}</p>}
        {q.last_viewed_at && <div className="flex justify-between"><span className="text-slate-600">Cliente viu o link</span><span>{dateTime(q.last_viewed_at)}</span></div>}
      </Card>

      <ItemsSummary doc={q} />

      {q.customer_notes && <Card className="text-sm"><strong>Observações:</strong> {q.customer_notes}</Card>}
      {q.internal_notes && <Card className="border-amber-200 bg-amber-50 text-sm"><strong>Interno:</strong> {q.internal_notes}</Card>}

      <Section title="Fotos">
        <PhotoManager parentType="quote" parentId={q.id} vehicleId={q.vehicle_id} />
      </Section>

      <Section title="Situação">
        <div className="grid grid-cols-2 gap-2">
          {expired && <Button variant="secondary" className="col-span-2" onClick={() => run(() => db.update('quotes', q.id, { valid_until: addDays(today(), settings.quote_validity_days), status: 'enviado' }), 'Validade renovada')}>Renovar validade</Button>}
          {q.status !== 'enviado' && !q.work_order_id && <Button variant="secondary" onClick={() => setStatus('enviado')}>Aguardando aprovação</Button>}
          {q.status !== 'aprovado' && <Button variant="secondary" onClick={() => setStatus('aprovado')}>Aprovado</Button>}
          {q.status !== 'recusado' && !q.work_order_id && <Button variant="secondary" onClick={() => setStatus('recusado')}>Recusado</Button>}
          {q.status !== 'cancelado' && !q.work_order_id && <Button variant="secondary" onClick={() => setStatus('cancelado')}>Cancelado</Button>}
        </div>
      </Section>

      <div className="grid grid-cols-3 gap-2 pb-4">
        <LinkButton to={`/orcamentos/${q.id}/editar`} variant="secondary">Editar</LinkButton>
        <Button variant="secondary" disabled={busy} onClick={async () => { const c = await run(() => duplicateQuote(q, session!.organizationId!, settings), 'Orçamento duplicado'); if (c) nav(`/orcamentos/${c.id}`) }}>Duplicar</Button>
        {q.archived_at ? (
          <Button variant="secondary" onClick={() => run(() => db.update('quotes', q.id, { archived_at: null }), 'Restaurado')}>Restaurar</Button>
        ) : (
          <Button variant="danger" onClick={() => confirm('Arquivar este orçamento? Você pode restaurá-lo depois.') && run(() => db.update('quotes', q.id, { archived_at: new Date().toISOString() }), 'Arquivado').then(() => nav('/orcamentos'))}>Arquivar</Button>
        )}
      </div>
      <p className="pb-4 text-center text-xs text-slate-400"><Link to="/orcamentos">Voltar para orçamentos</Link></p>

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
