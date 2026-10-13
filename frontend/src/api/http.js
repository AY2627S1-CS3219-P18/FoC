/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Created the shared fetch wrapper for the frontend. The access token is held in memory only and
 *        the httpOnly refresh cookie restores it through POST /auth/refresh (team decision in chat,
 *        2026-09-30; cookie behaviour per instructions.md Stage 4). Requests use same-origin paths
 *        (Vite proxy in development, API gateway in deployment). No requirements, architecture, schema,
 *        or API decisions were made by the AI tool.
 * Author review: Congchen
  *
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Identical in-flight GET requests share one network call. No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: Congchen
 */

// In memory only: a page reload loses it, and the refresh cookie gets a new one.
let accessToken = null
let refreshing = null
let onSessionExpired = () => {}

export const setAccessToken = (token) => {
  accessToken = token
}
export const setOnSessionExpired = (callback) => {
  onSessionExpired = callback
}

// Error envelope from the services: { status_code, error, message, timestamp, details? } (supplier
// service) or { message, code } (user service).
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || 'Request failed (' + status + ')')
    this.status = status
    this.code = body?.code
    this.details = Array.isArray(body?.details) ? body.details : []
  }
}

const readBody = async (response) => {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

// One refresh at a time: concurrent 401s share the same request.
export function refreshAccessToken() {
  if (!refreshing) {
    refreshing = fetch('/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(async (response) => {
        const body = await readBody(response)
        if (!response.ok) throw new ApiError(response.status, body)
        accessToken = body.accessToken
        return accessToken
      })
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

const withQuery = (path, query) => {
  if (!query) return path
  const params = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  const text = params.toString()
  return text ? path + '?' + text : path
}

// Identical GETs that are still in flight share one network request (React strict mode runs effects twice
// in development, and several components can ask for the same list). Nothing is cached after it finishes.
const inFlight = new Map()

export function request(path, options = {}, retried = false) {
  const { method = 'GET', query } = options
  if (method !== 'GET') return send(path, options, retried)
  const key = withQuery(path, query)
  if (!inFlight.has(key)) {
    inFlight.set(
      key,
      send(path, options, retried).finally(() => inFlight.delete(key)),
    )
  }
  return inFlight.get(key)
}

// `json` sends a JSON body, `form` a FormData (the browser sets the multipart boundary).
async function send(path, { method = 'GET', query, json, form, headers = {} } = {}, retried = false) {
  const finalHeaders = { ...headers }
  if (accessToken) finalHeaders.Authorization = 'Bearer ' + accessToken
  let body
  if (json !== undefined) {
    finalHeaders['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) {
    body = form
  }

  const response = await fetch(withQuery(path, query), {
    method,
    headers: finalHeaders,
    body,
    credentials: 'include',
  })

  if (response.status === 401 && !retried && !path.startsWith('/auth/')) {
    try {
      await refreshAccessToken()
    } catch {
      accessToken = null
      onSessionExpired()
      throw new ApiError(401, { message: 'Your session has expired. Please log in again.' })
    }
    return send(path, { method, query, json, form, headers }, true)
  }

  const payload = await readBody(response)
  if (!response.ok) throw new ApiError(response.status, payload)
  return payload
}
