/** Redimensiona (lado maior ≤ maxSide) e converte para JPEG, respeitando a orientação EXIF. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null)
  let w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
  if (bitmap) {
    w = bitmap.width
    h = bitmap.height
    draw = (ctx, cw, ch) => ctx.drawImage(bitmap, 0, 0, cw, ch)
  } else {
    const img = await loadImg(file)
    w = img.naturalWidth
    h = img.naturalHeight
    draw = (ctx, cw, ch) => ctx.drawImage(img, 0, 0, cw, ch)
  }
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')!
  draw(ctx, canvas.width, canvas.height)
  bitmap?.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao comprimir a imagem'))), 'image/jpeg', quality),
  )
}

function loadImg(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Imagem inválida'))
    img.src = URL.createObjectURL(file)
  })
}
