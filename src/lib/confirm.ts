/**
 * Confirmação dentro da página (substitui window.confirm, que alguns navegadores
 * embutidos e pré-visualizações bloqueiam). Não depende do React.
 */
export function askConfirm(message: string, okLabel = 'Confirmar'): Promise<boolean> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div')
    wrap.className = 'fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-4 sm:items-center'
    wrap.setAttribute('role', 'dialog')
    wrap.setAttribute('aria-modal', 'true')
    const box = document.createElement('div')
    box.className = 'w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl'
    const p = document.createElement('p')
    p.className = 'text-base text-slate-900'
    p.textContent = message
    const row = document.createElement('div')
    row.className = 'grid grid-cols-2 gap-2'
    const btn = (label: string, cls: string, value: boolean) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.className = `min-h-11 rounded-lg px-4 font-semibold ${cls}`
      b.onclick = () => close(value)
      return b
    }
    const cancel = btn('Cancelar', 'border border-slate-300 bg-white text-slate-800', false)
    const ok = btn(okLabel, 'bg-brand-700 text-white', true)
    const close = (v: boolean) => {
      document.removeEventListener('keydown', onKey)
      wrap.remove()
      resolve(v)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(false)
    wrap.onclick = (e) => e.target === wrap && close(false)
    document.addEventListener('keydown', onKey)
    row.append(cancel, ok)
    box.append(p, row)
    wrap.append(box)
    document.body.append(wrap)
    ok.focus()
  })
}
