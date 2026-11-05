import { askConfirm } from '../lib/confirm'
import { Copy, Eye, QrCode } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../lib/app'
import { dateTime } from '../lib/format'
import { copyText, publicUrl, whatsappUrl } from '../lib/share'
import { Button, Sheet } from './ui'

export function useQr(text: string, size = 240) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!text) return
    QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: 'M' }).then(setUrl).catch(() => setUrl(''))
  }, [text, size])
  return url
}

/** Link público + QR Code + envio por WhatsApp. */
/** Ícone do WhatsApp (balão com telefone). */
export function WaIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  )
}

/** Link público + QR Code + envio por WhatsApp. */
export function ShareBox({ open, onClose, token, enabled, lastViewed, phone, message, onToggle, onRegenerate, onSent }: {
  open: boolean; onClose: () => void; token: string; enabled: boolean; lastViewed?: string | null; phone?: string; message: string
  onToggle: (enabled: boolean) => void; onRegenerate: () => void; onSent?: () => void
}) {
  const { toast } = useApp()
  const link = publicUrl(token)
  const qr = useQr(link, 480)
  const viewCls = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-card px-4 font-semibold ring-1 ring-slate-200 active:bg-slate-50'
  return (
    <Sheet open={open} onClose={onClose} title="Mandar para o cliente">
      {enabled ? (
        <>
          <div className="rounded-2xl bg-wa-soft p-3 text-sm leading-relaxed [overflow-wrap:anywhere] text-slate-800">{message}</div>
          <a href={whatsappUrl(phone, message)} target="_blank" rel="noreferrer" onClick={onSent}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-wa px-4 text-base font-bold text-white active:bg-wa-dark">
            <WaIcon size={22} /> Enviar pelo WhatsApp
          </a>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" icon={Copy} onClick={async () => toast((await copyText(link)) ? 'Link copiado' : 'Não foi possível copiar', 'ok')}>Copiar link</Button>
            {import.meta.env.VITE_DEMO ? (
              <Link to={`/c/${token}`} className={viewCls}><Eye size={19} /> Ver como cliente</Link>
            ) : (
              <a href={link} target="_blank" rel="noreferrer" className={viewCls}><Eye size={19} /> Ver como cliente</a>
            )}
          </div>
          <p className="text-center text-xs text-slate-500">{lastViewed ? `O cliente abriu o link em ${dateTime(lastViewed)}` : 'O cliente ainda não abriu o link.'}</p>
          <details className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-600"><QrCode size={18} /> QR Code e opções do link</summary>
            <div className="mt-3 flex flex-col items-center gap-3">
              {qr && <img src={qr} alt="QR Code do link" className="h-48 w-48 rounded-lg bg-card p-2" />}
              <div className="grid w-full grid-cols-2 gap-2">
                <Button variant="danger" onClick={async () => (await askConfirm('Desativar o link? O cliente não conseguirá mais abrir a página.', 'Desativar')) && onToggle(false)}>Desativar link</Button>
                <Button variant="secondary" onClick={async () => (await askConfirm('Gerar um novo link? O link antigo deixará de funcionar.', 'Gerar')) && onRegenerate()}>Novo link</Button>
              </div>
            </div>
          </details>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-600">O link do cliente está desativado.</p>
          <Button className="w-full" onClick={() => onToggle(true)}>Ativar link</Button>
        </>
      )}
    </Sheet>
  )
}
