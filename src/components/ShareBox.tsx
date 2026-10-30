import { askConfirm } from '../lib/confirm'
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
export function ShareBox({ open, onClose, token, enabled, lastViewed, phone, message, onToggle, onRegenerate, onSent }: {
  open: boolean; onClose: () => void; token: string; enabled: boolean; lastViewed?: string | null; phone?: string; message: string
  onToggle: (enabled: boolean) => void; onRegenerate: () => void; onSent?: () => void
}) {
  const { toast } = useApp()
  const link = publicUrl(token)
  const qr = useQr(link, 480)
  return (
    <Sheet open={open} onClose={onClose} title="Enviar ao cliente">
      {enabled ? (
        <>
          <a href={whatsappUrl(phone, message)} target="_blank" rel="noreferrer" onClick={onSent}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 text-base font-bold text-white active:bg-green-700">
            Enviar pelo WhatsApp
          </a>
          <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">{message}</p>
          <div className="flex flex-col items-center gap-2">
            {qr && <img src={qr} alt="QR Code do link" className="h-52 w-52" />}
            <div className="grid w-full grid-cols-2 gap-2">
              <Button variant="secondary" onClick={async () => toast((await copyText(link)) ? 'Link copiado' : 'Não foi possível copiar', 'ok')}>Copiar link</Button>
              <a href={qr} download={`qrcode-${token.slice(0, 6)}.png`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 font-semibold">Baixar QR</a>
            </div>
            {import.meta.env.VITE_DEMO ? (
              <Link to={`/c/${token}`} className="text-sm font-semibold text-blue-700">Abrir página do cliente ↗</Link>
            ) : (
              <a href={link} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-700">Abrir página do cliente ↗</a>
            )}
          </div>
          <p className="text-xs text-slate-500">{lastViewed ? `Cliente abriu o link em ${dateTime(lastViewed)}` : 'O cliente ainda não abriu o link.'}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="danger" onClick={async () => await askConfirm('Desativar o link? O cliente não conseguirá mais abrir a página.') && onToggle(false)}>Desativar link</Button>
            <Button variant="secondary" onClick={async () => await askConfirm('Gerar um novo link? O link antigo deixará de funcionar.') && onRegenerate()}>Gerar novo link</Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-600">O link público está desativado.</p>
          <Button className="w-full" onClick={() => onToggle(true)}>Ativar link</Button>
        </>
      )}
    </Sheet>
  )
}
