/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Created the Supplier Service client. Paths, query parameters and multipart fields restate
 *        supplier-service/openapi.yaml (SupplierServiceArchitecture.md §7). No requirements,
 *        architecture, schema, or API decisions were made by the AI tool.
 * Author review: Congchen
 */

import { request } from './http'

const BASE = '/api/v1'

// --- user reads -------------------------------------------------------------------------
// params: { page, search, location_id, category_id, isOpen, sortOrder } (limit is fixed at 50)
export const listSuppliers = (params) => request(BASE + '/suppliers', { query: params })
export const getSupplier = (id) => request(BASE + '/suppliers/' + id)
export const listLocationOptions = () => request(BASE + '/suppliers/reference/location')
export const listCategoryOptions = () => request(BASE + '/suppliers/reference/categories')

// --- admin ------------------------------------------------------------------------------
export const listAdminSuppliers = (params) => request(BASE + '/admin/suppliers', { query: params })
export const getAdminSupplier = (id) => request(BASE + '/admin/suppliers/' + id)
export const deleteSupplier = (id) => request(BASE + '/admin/suppliers/' + id, { method: 'DELETE' })

// Opening hours the API expects for the form state: a Facility sends none (the server fills day 8), a
// 24/7 Store sends the single day-8 entry, any other Store sends its per-day entries.
function hoursField({ type, is24h, openingHours }) {
  if (type === 'Facility') return null
  if (is24h) return [{ day: 8, open: '00:00', close: '23:59' }]
  return openingHours.map(({ day, open, close }) => ({ day, open, close }))
}

function appendCommon(form, values) {
  form.append('name', values.name.trim())
  form.append('type', values.type)
  form.append('location_id', String(values.locationId))
  form.append('category_id', JSON.stringify(values.categoryIds))
  const hours = hoursField(values)
  if (hours) form.append('openingHours', JSON.stringify(hours))
  if (values.type === 'Store') form.append('is24h', values.is24h ? 'true' : 'false')
}

// Create: multipart, with the mandatory Idempotency-Key. 201 created, or 200 when a matching
// soft-deleted supplier was reactivated.
export function createSupplier(values) {
  const form = new FormData()
  appendCommon(form, values)
  if (values.desc.trim()) form.append('desc', values.desc.trim())
  values.photos.forEach((photo) => form.append('photos', photo.file))
  return request(BASE + '/admin/suppliers', {
    method: 'POST',
    form,
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  })
}

// Update: multipart. `version` is the one last read (stale -> 409). `values.photos` is the final ordered
// list: existing photos carry a numeric photoId, new ones a placeholder string and a File.
export function updateSupplier(id, version, values, photosChanged) {
  const form = new FormData()
  form.append('version', String(version))
  appendCommon(form, values)
  form.append('desc', values.desc.trim())
  form.append('isActive', values.isActive ? 'true' : 'false')
  form.append('isPhotoDirty', photosChanged ? 'true' : 'false')
  if (photosChanged) {
    const added = values.photos.filter((photo) => photo.file)
    form.append('photo_ids', JSON.stringify(values.photos.map((photo) => photo.photoId)))
    form.append('placeholder_ids', JSON.stringify(added.map((photo) => photo.photoId)))
    added.forEach((photo) => form.append('photos', photo.file))
  }
  return request(BASE + '/admin/suppliers/' + id, { method: 'PUT', form })
}
