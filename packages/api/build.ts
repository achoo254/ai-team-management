import { build } from 'esbuild'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/** Parse .env file into key-value pairs */
function parseEnvFile(filePath: string): Record<string, string> {
  try {
    const content = readFileSync(resolve(filePath), 'utf-8')
    const env: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      env[key] = val
    }
    return env
  } catch {
    console.warn(`⚠ Env file not found: ${filePath}`)
    return {}
  }
}

// Determine env file from CLI arg: --env=.env.staging (default: .env)
const envArg = process.argv.find(a => a.startsWith('--env='))
const envFile = envArg ? envArg.split('=')[1] : '.env'

const env = parseEnvFile(envFile)

// Convert env vars to esbuild define map: process.env.KEY → "value"
const define: Record<string, string> = {}
for (const [key, val] of Object.entries(env)) {
  define[`process.env.${key}`] = JSON.stringify(val)
}

console.log(`📦 Building with ${envFile} (${Object.keys(env).length} vars inlined)`)

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/index.js',
  packages: 'external',
  define,
})

console.log('✅ Built → dist/index.js')
