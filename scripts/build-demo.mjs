// Gera uma página HTML única de demonstração (dados de exemplo, salvos só no navegador).
// Uso: node scripts/build-demo.mjs [saida.html]
import { build } from 'vite'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const out = process.argv[2] ?? 'dist-demo/lataria-demo.html'
process.env.VITE_DEMO = '1'
process.env.VITE_SUPABASE_URL = ''
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = ''
process.env.VITE_SUPABASE_ANON_KEY = ''
await build({
  logLevel: 'warn',
  build: { outDir: 'dist-demo', emptyOutDir: true, rollupOptions: { output: { inlineDynamicImports: true } } },
})
const assets = readdirSync('dist-demo/assets')
const css = readFileSync(join('dist-demo/assets', assets.find((f) => f.endsWith('.css'))), 'utf8')
const js = readFileSync(join('dist-demo/assets', assets.find((f) => f.endsWith('.js'))), 'utf8').replace(/<\/script/gi, '<\\/script')
const icon = 'data:image/svg+xml;base64,' + Buffer.from(readFileSync('public/icon.svg')).toString('base64')
writeFileSync(
  out,
  `<title>Lataria</title>
<link rel="icon" href="${icon}">
<style>${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`,
)
console.log('ok', out, Math.round(readFileSync(out).length / 1024), 'KB')
