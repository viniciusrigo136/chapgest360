/** Marca ChapGest 360 (família TecGest 360): símbolo "CG" + nome em Manrope. */
export function Logo({ size = 'md', subtitle }: { size?: 'md' | 'lg'; subtitle?: string }) {
  const big = size === 'lg'
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className={`flex shrink-0 items-center justify-center rounded-xl bg-brand-600 font-heading font-extrabold tracking-tight text-white ${big ? 'h-14 w-14 text-xl' : 'h-9 w-9 text-sm'}`}>CG</span>
      <span className="min-w-0">
        <span className={`block truncate font-heading font-extrabold tracking-tight text-ink ${big ? 'text-3xl' : 'text-[17px]'}`}>
          ChapGest <span className="text-brand-600">360</span>
        </span>
        {subtitle && <span className="block truncate text-xs text-slate-500">{subtitle}</span>}
      </span>
    </span>
  )
}
