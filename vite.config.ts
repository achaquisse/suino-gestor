import tailwindcss from '@tailwindcss/vite'
import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

// Emits /sw.js from src/pwa/sw.js with this build's files baked in as the precache list.
function pwaPlugin(): Plugin {
  const publicFiles = (dir: string, base = ''): string[] =>
    readdirSync(new URL(dir, import.meta.url), { withFileTypes: true }).flatMap((d) =>
      d.isDirectory() ? publicFiles(`${dir}${d.name}/`, `${base}${d.name}/`) : [`/${base}${d.name}`])
  return {
    name: 'porkflow-pwa',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = ['/index.html', ...Object.keys(bundle).map((f) => `/${f}`), ...publicFiles('./public/')]
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12)
      const source = readFileSync(new URL('./src/pwa/sw.js', import.meta.url), 'utf8')
        .replace("const VERSION = '__VERSION__'", `const VERSION = ${JSON.stringify(version)}`)
        .replace('const PRECACHE = __PRECACHE__', `const PRECACHE = ${JSON.stringify([...new Set(files)])}`)
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss(), pwaPlugin()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
