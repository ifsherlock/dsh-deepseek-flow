/**
 * Host half of dsh-deepseek-flow.
 *
 * The whole effect lives in the browser (a WebGL canvas behind the app), so the
 * host half only needs to:
 *   1. declare a settings section so the browser half can read the knobs
 *      (enabled / speed / intensity / scrim / opacity),
 *   2. expose a tiny same-origin endpoint for the settings row, and
 *   3. keep the row's namespace alive across profile reloads.
 *
 * Persistence uses the profile's own cordis.patch.yml entry config (the
 * dsh 0.1.7+ settings service keys the section on the entry id), so no extra
 * files are written.
 */
import z from '@deepseek-ai/schemastery'

export const FLOW_API_PREFIX = '/api/deepseek-flow'
export const FLOW_ENTRY_ID = 'deepseek-flow'

const NUM_BOUNDS = {
  speed: { min: 0, max: 100 },
  intensity: { min: 0, max: 100 },
  scrim: { min: 0, max: 100 },
  opacity: { min: 0, max: 100 },
  cardOpacity: { min: 0, max: 100 },
}

const FIELDS = {
  enabled: z.boolean().default(true),
  speed: z.number().min(0).max(100).default(14),
  intensity: z.number().min(0).max(100).default(100),
  scrim: z.number().min(0).max(100).default(6),
  opacity: z.number().min(0).max(100).default(100),
  cardOpacity: z.number().min(0).max(100).default(20),
}

export const FlowSettingsSchema = z.object(FIELDS)
export const Config = z.object(
  Object.fromEntries(Object.entries(FIELDS).map(([k, v]) => [k, v.volatile()])),
)

const DEFAULTS = {
  enabled: true,
  speed: 14,
  intensity: 100,
  scrim: 6,
  opacity: 100,
  cardOpacity: 20,
}

function json(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

function isSameOriginRequest(req) {
  const site = req.headers['sec-fetch-site']
  if (typeof site === 'string' && site === 'cross-site') return false
  const host = req.headers.host
  if (typeof host !== 'string' || host === '') return false
  const origin = req.headers.origin
  if (typeof origin === 'string' && origin !== '' && origin !== 'null') {
    try {
      return new URL(origin).host === host
    } catch {
      return false
    }
  }
  return true
}

function readJsonBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body-too-large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('invalid-json'))
      }
    })
    req.on('error', reject)
  })
}

function sanitize(body, current) {
  const next = { ...current }
  for (const [key, { min, max }] of Object.entries(NUM_BOUNDS)) {
    const value = body[key]
    if (value === undefined) continue
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`invalid-${key}`)
    if (value < min || value > max) throw new Error(`invalid-${key}`)
    next[key] = value
  }
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== 'boolean') throw new Error('invalid-enabled')
    next.enabled = body.enabled
  }
  return next
}

function readSection(settings, namespace) {
  try {
    const value = settings.get?.(namespace)
    if (value && typeof value === 'object') return { ...DEFAULTS, ...value }
  } catch {
    /* fall through to defaults */
  }
  return { ...DEFAULTS }
}

/**
 * Register the settings section and its route family.
 * @param ctx - host context that acquires the settings + webServer services.
 */
export function apply(ctx) {
  ctx.inject(['settings', 'webServer'], (hostCtx) => {
    const settings = hostCtx.settings
    const entryId = ctx.fiber?.entry?.options?.id
    const namespace = entryId ?? FLOW_ENTRY_ID

    try {
      if (typeof settings.register === 'function') {
        settings.register(namespace, FlowSettingsSchema, { applies: 'live' })
      }
    } catch (error) {
      console.error('[dsh-deepseek-flow] settings register failed:', error)
    }

    const routes = [
      {
        kind: 'exact',
        path: `${FLOW_API_PREFIX}/settings`,
        handler: async (req, res) => {
          if (!isSameOriginRequest(req)) return json(res, 403, { ok: false, error: 'cross-site-request-rejected' })
          if (req.method === 'GET') return json(res, 200, { ok: true, value: readSection(settings, namespace) })
          if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method-not-allowed' })
          try {
            const current = readSection(settings, namespace)
            const next = sanitize(await readJsonBody(req), current)
            if (typeof settings.replace === 'function') await settings.replace(namespace, next)
            else if (typeof settings.set === 'function') settings.set(namespace, next)
            else throw new Error('settings-write-unsupported')
            return json(res, 200, { ok: true, value: readSection(settings, namespace) })
          } catch (error) {
            return json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
          }
        },
      },
    ]

    for (const route of routes) {
      try {
        hostCtx.effect(() => hostCtx.webServer.register(route), 'dsh-deepseek-flow: settings route')
      } catch (error) {
        console.error('[dsh-deepseek-flow] route registration failed:', error)
      }
    }
  })
}
