import { Camera, ImagePlus } from 'lucide-react'
import { askConfirm } from '../lib/confirm'
import { useEffect, useRef, useState } from 'react'
import { useApp, useLoad } from '../lib/app'
import { db, filePath } from '../lib/db'
import { compressImage } from '../lib/image'
import type { Photo, PhotoParent, Stage } from '../lib/types'
import { Button, Field, Input, Select, Sheet } from './ui'

export function usePhotoUrl(path?: string, publicToken?: string) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!path) return
    let alive = true
    ;(publicToken ? db.publicFileUrl(publicToken, path) : db.fileUrl(path)).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [path, publicToken])
  return url
}

export function Thumb({ path, className = '', token }: { path: string; className?: string; token?: string }) {
  const url = usePhotoUrl(path, token)
  return url ? <img src={url} alt="" loading="lazy" className={`object-cover ${className}`} /> : <div className={`animate-pulse bg-slate-200 ${className}`} />
}

interface Pending { id: string; name: string; status: 'enviando' | 'erro'; file: File }

export function PhotoManager({ parentType, parentId, vehicleId, stages, defaultStage }: {
  parentType: PhotoParent; parentId: string; vehicleId?: string; stages?: Stage[]; defaultStage?: string
}) {
  const { session, toast, refresh } = useApp()
  const { data: photos, reload } = useLoad(async () => (await db.list('photos', { parent_id: parentId })).sort((a, b) => a.position - b.position), [parentId])
  const [pending, setPending] = useState<Pending[]>([])
  const [open, setOpen] = useState<Photo | null>(null)
  const camRef = useRef<HTMLInputElement>(null)
  const galRef = useRef<HTMLInputElement>(null)

  async function uploadOne(p: Pending, position: number) {
    setPending((x) => x.map((y) => (y.id === p.id ? { ...y, status: 'enviando' } : y)))
    try {
      const blob = await compressImage(p.file)
      const path = filePath(session!.organizationId!)
      await db.uploadFile(path, blob)
      await db.insert('photos', { parent_type: parentType, parent_id: parentId, vehicle_id: vehicleId ?? null, path, stage: defaultStage, is_public: true, position, caption: '' })
      setPending((x) => x.filter((y) => y.id !== p.id))
      return true
    } catch {
      setPending((x) => x.map((y) => (y.id === p.id ? { ...y, status: 'erro' } : y)))
      return false
    }
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    const list = Array.from(files).map((file) => ({ id: crypto.randomUUID(), name: file.name, status: 'enviando' as const, file }))
    setPending((x) => [...x, ...list])
    let pos = (photos?.length ?? 0)
    let fails = 0
    for (const p of list) if (!(await uploadOne(p, pos++))) fails++
    if (fails) toast(`${fails} foto(s) não foram enviadas. Toque em "tentar de novo".`, 'erro')
    reload()
    refresh()
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" icon={Camera} onClick={() => camRef.current?.click()}>Tirar foto</Button>
        <Button variant="secondary" icon={ImagePlus} onClick={() => galRef.current?.click()}>Galeria</Button>
      </div>
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />

      {pending.length > 0 && (
        <ul className="space-y-1 text-sm">
          {pending.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded bg-slate-100 px-3 py-2">
              <span className="truncate">{p.status === 'enviando' ? 'Enviando… ' : 'Falhou: '}{p.name}</span>
              {p.status === 'erro' && (
                <button type="button" className="font-semibold text-brand-700" onClick={async () => { await uploadOne(p, photos?.length ?? 0); reload() }}>
                  tentar de novo
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {photos && photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <button key={p.id} type="button" onClick={() => setOpen(p)} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
              <Thumb path={p.path} className="h-full w-full" />
              {!p.is_public && <span className="absolute left-1 top-1 rounded bg-slate-900/80 px-1.5 text-[10px] font-bold text-white">INTERNA</span>}
              {p.stage && stages && <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 text-[10px] text-white">{stages.find((s) => s.key === p.stage)?.name}</span>}
            </button>
          ))}
        </div>
      ) : (
        photos && pending.length === 0 && <p className="text-sm text-slate-500">Fotos ajudam o cliente a entender o serviço e a aprovar mais rápido.</p>
      )}

      {open && <PhotoSheet photo={open} stages={stages} all={photos ?? []} onClose={() => { setOpen(null); reload(); refresh() }} />}
    </div>
  )
}

function PhotoSheet({ photo, stages, all, onClose }: { photo: Photo; stages?: Stage[]; all: Photo[]; onClose: () => void }) {
  const url = usePhotoUrl(photo.path)
  const [p, setP] = useState(photo)
  const { toast } = useApp()
  async function save(patch: Partial<Photo>) {
    const next = { ...p, ...patch }
    setP(next)
    try {
      await db.update('photos', p.id, patch)
    } catch (e) {
      toast((e as Error).message, 'erro')
    }
  }
  async function move(dir: -1 | 1) {
    const sorted = [...all].sort((a, b) => a.position - b.position)
    const i = sorted.findIndex((x) => x.id === p.id)
    const j = i + dir
    if (j < 0 || j >= sorted.length) return
    ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
    await Promise.all(sorted.map((x, k) => (x.position !== k ? db.update('photos', x.id, { position: k }) : null)))
    onClose()
  }
  return (
    <Sheet open onClose={onClose} title="Foto">
      {url && (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="" className="max-h-[50dvh] w-full rounded-lg bg-slate-100 object-contain" />
        </a>
      )}
      <Field label="Legenda">
        <Input value={p.caption ?? ''} onChange={(e) => setP({ ...p, caption: e.target.value })} onBlur={() => save({ caption: p.caption })} placeholder="Ex.: Amassado na porta" />
      </Field>
      {stages && (
        <Field label="Etapa">
          <Select value={p.stage ?? ''} onChange={(e) => save({ stage: e.target.value || undefined })}>
            <option value="">—</option>
            {stages.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </Select>
        </Field>
      )}
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="h-5 w-5" checked={p.is_public} onChange={(e) => save({ is_public: e.target.checked })} />
        <span>Mostrar para o cliente (documento e link)</span>
      </label>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="secondary" onClick={() => move(-1)}>← Antes</Button>
        <Button variant="secondary" onClick={() => move(1)}>Depois →</Button>
        <Button variant="danger" onClick={async () => {
          if (!(await askConfirm('Excluir esta foto?', 'Excluir'))) return
          await db.remove('photos', p.id)
          await db.deleteFile(p.path)
          onClose()
        }}>Excluir</Button>
      </div>
    </Sheet>
  )
}
