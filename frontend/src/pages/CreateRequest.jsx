/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5), date: 2026-09-08
 * Scope: Generated UI mockup component CreateRequest.jsx from team-authored blueprint.md.
 *        Visual/layout implementation only. No requirements, architecture, or
 *        schema decisions were made by the AI tool.
 * Author review: <pending — team member to sign>
 *
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Shows the supplier's faculty where the old location text was shown. No requirements, architecture, schema, or API decisions were made by
 *        the AI tool.
 * Author review: Congchen
 *
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: The pick-up supplier picker and the preselected supplier (?supplier=id) load from the Supplier Service. The request itself is still mocked (Order Service not connected). No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: Congchen
 *
 * Tool: Copilot SDK (model: unspecified by runtime), date: 2026-10-20
 * Scope: Connected the post-errand button to the existing Order Service POST /orders endpoint and
 *        added submission loading and error states. No requirements, architecture, schema, or API
 *        decisions were made by the AI tool.
 * Author review: tng wen xi
 *
 * Tool: Copilot SDK (model: unspecified by runtime), date: 2026-10-20
 * Scope: Reused the create form for editing existing orders and submitted non-credit fields
 *        through the existing order-service edit endpoint.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 *
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope: Order Service frontend integration - Post sends POST /orders (supplier id, delivery
 *        location id from the supplier-service location list, credits, optional complete-by and
 *        details), then shows a spinner until the reservation outcome arrives (order:created /
 *        order:cancelled with its reason over the socket, with a /orders/mine re-check as a
 *        fallback) and opens My activity. The stay-open and scheduled-posting fields stay hidden
 *        (George, 2026-10-20) and their unused state is removed.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): Carried over Wen Xi's edit page (merged in PR #115) onto this form, per
 *        George: /requests/:id/edit loads the errand from GET /orders/mine, mounts the form with
 *        its fields, hides the offer, and saves with PATCH /orders/:id/edit (delivery location
 *        id, complete-by or null, details or null).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): Rebased onto PR #115. George chose to keep this implementation, so the
 *        version of this file described in Wen Xi's entries above was replaced.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): `failed` status - the reservation outcome is order:created or
 *        order:failed (with its reason); the re-check treats an order missing from
 *        /orders/mine as failed, since that list leaves failed orders out.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): Login prompt waits for the session restore (sessionReady), as
 *        Wallet.jsx does, so a reload while signed in no longer opens it.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Loader2, Minus, Plus } from 'lucide-react'
import Button from '../components/Button'
import SupplierImage from '../components/SupplierImage'
import { useApi, useReferenceData } from '../api/useApi'
import { getSupplier, listSuppliers } from '../api/suppliers'
import { createOrder, editOrder, listMyOrders, reserveFailureMessage } from '../api/orders'
import { watchOrderEvents } from '../realtime/orderSocket'
import { qualifiedName } from '../data/suppliers'
import { useDemo } from '../context/DemoContext'

const MAX_CHARS = 200
const RECHECK_MS = 5000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// The reservation runs asynchronously after the 202. Its outcome normally arrives as an order event;
// if the socket is down or the event was missed, the caller's own orders are re-checked every few
// seconds until the order leaves `pending`.
async function reservationOutcome(orderId, watch) {
  let done = false
  const viaSocket = watch
    .next(
      (name, p) =>
        p?.orderId === orderId && (name === 'order:created' || name === 'order:failed'),
    )
    .then(({ payload }) => ({ status: payload.status, reason: payload.reason }))
  const viaRecheck = (async () => {
    while (!done) {
      await sleep(RECHECK_MS)
      if (done) break
      try {
        const { orders } = await listMyOrders('requester')
        const order = orders.find((o) => o.id === orderId)
        // /orders/mine leaves failed orders out, so a just-created order missing from it has failed.
        if (!order) return { status: 'failed' }
        if (order.status !== 'pending') return { status: order.status }
      } catch {
        // keep waiting; the socket may still deliver
      }
    }
    return new Promise(() => {})
  })()
  try {
    return await Promise.race([viaSocket, viaRecheck])
  } finally {
    done = true
  }
}

// Defaults follow the clock rather than a hardcoded date that goes stale overnight.
const today = () => new Date().toISOString().slice(0, 10)

const pad = (n) => String(n).padStart(2, '0')
// Local date and time inputs for an ISO timestamp.
const localDate = (iso) => {
  const d = new Date(iso)
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}
const localTime = (iso) => {
  const d = new Date(iso)
  return pad(d.getHours()) + ':' + pad(d.getMinutes())
}

// Order F18 (Wen Xi's edit page, carried over): /requests/:id/edit reuses the form for one of the
// requester's errands. The form mounts once that order is loaded, so its fields start from it.
export default function CreateRequest() {
  const { id: editId } = useParams()
  const { data, loading, error } = useApi(
    () => (editId ? listMyOrders('requester') : Promise.resolve(null)),
    [editId],
  )
  if (!editId) return <RequestForm order={null} />
  const order = data?.orders?.find((o) => o.id === editId)
  if (order) return <RequestForm key={order.id} order={order} />
  return (
    <div className="page-gutter mx-auto w-full max-w-[640px] py-8 md:py-10">
      <h1 className="font-display text-2xl font-bold text-ink md:text-3xl">Edit errand</h1>
      {loading || (!data && !error) ? (
        <p className="mt-4 text-sm text-ink-70">Loading errand…</p>
      ) : (
        <p role="alert" className="mt-4 text-sm text-alert">
          {error ? error.message : 'This errand was not found.'}
        </p>
      )}
    </div>
  )
}

// Order F1.1.1 — supplier, description, delivery location, credits offered, expiration,
// additional details. Plus the scheduled-errand and bookmarked-location nice-to-haves.
// `order` is the errand being edited (F18), or null when posting a new one.
function RequestForm({ order }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { credits, isLoggedIn, sessionReady, requireLogin } = useDemo()
  const isEdit = order !== null

  // Gated when logged out (§9): the page stays visible behind the scrim.
  useEffect(() => {
    if (sessionReady && !isLoggedIn) requireLogin('You need an account to post an errand.')
  }, [sessionReady, isLoggedIn, requireLogin])

  const [supplierId, setSupplierId] = useState(
    isEdit ? String(order.supplierId) : params.get('supplier') || '',
  )
  const [description, setDescription] = useState(order?.description ?? '')
  const [locationId, setLocationId] = useState(isEdit ? String(order.deliveryLocationId) : '')
  const [timing, setTiming] = useState(order?.completeBy ? 'later' : 'asap')
  const [date, setDate] = useState(order?.completeBy ? localDate(order.completeBy) : today)
  const [time, setTime] = useState(order?.completeBy ? localTime(order.completeBy) : '15:30')
  const [offer, setOffer] = useState(4)
  const [extra, setExtra] = useState(order?.additionalDetails ?? '')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState(null)
  const { locations } = useReferenceData()

  // The supplier comes from the Supplier Service; the first page of the list feeds the picker.
  const { data: supplierPage } = useApi(() => listSuppliers({ sortOrder: 'A-Z' }), [])
  const { data: chosen } = useApi(() => (supplierId ? getSupplier(supplierId) : Promise.resolve(null)), [supplierId])
  const suppliers = supplierPage?.data ?? []
  const supplier = supplierId ? chosen : null

  const insufficient = !isEdit && offer > credits.available
  const remaining = credits.available - offer
  const deadline = timing === 'later' ? new Date(date + 'T' + time) : null
  const deadlineInvalid = deadline !== null && Number.isNaN(deadline.getTime())
  const complete = Boolean(supplierId && description.trim() && locationId) && !deadlineInvalid

  // F18: PATCH /orders/:id/edit with the editable fields; credits stay as reserved.
  const onSave = async () => {
    setPosting(true)
    setPostError(null)
    try {
      await editOrder(order.id, {
        supplierId: Number(supplierId),
        description: description.trim(),
        deliveryLocationId: Number(locationId),
        completeBy: deadline ? deadline.toISOString() : null,
        additionalDetails: extra.trim() || null,
      })
      navigate('/activity')
    } catch (e) {
      setPostError(e.message)
    } finally {
      setPosting(false)
    }
  }

  const onPost = async () => {
    if (!requireLogin('You need an account to post an errand.')) return
    setPosting(true)
    setPostError(null)
    const watch = watchOrderEvents() // before the POST, so a fast outcome is not missed
    try {
      const order = await createOrder({
        supplierId: Number(supplierId),
        description: description.trim(),
        deliveryLocationId: Number(locationId),
        credits: offer,
        ...(deadline && { completeBy: deadline.toISOString() }),
        additionalDetails: extra.trim() || null,
      })
      const outcome = await reservationOutcome(order.id, watch)
      if (outcome.status === 'failed') {
        setPostError(reserveFailureMessage(outcome.reason))
      } else {
        navigate('/activity')
      }
    } catch (e) {
      setPostError(e.message)
    } finally {
      watch.stop()
      setPosting(false)
    }
  }

  const label = (text, htmlFor) => (
    <label htmlFor={htmlFor} className="block text-base font-semibold text-ink">
      {text}
    </label>
  )

  return (
    <div className="page-gutter mx-auto w-full max-w-[640px] py-8 pb-32 md:py-10 md:pb-10">
      <h1 className="font-display text-2xl font-bold text-ink md:text-3xl">
        {isEdit ? 'Edit errand' : 'Post an errand'}
      </h1>

      <div className="mt-8 space-y-8">
        {/* 1. Pick-up from */}
        <section>
          {label('Pick-up from', 'supplier')}
          {supplier ? (
            <div className="mt-2 flex items-center gap-3 rounded-card border border-line p-3">
              <div className="w-16 shrink-0">
                <SupplierImage supplier={supplier} ratio="aspect-square" rounded="rounded-[10px]" compact />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {qualifiedName(supplier)}
                </p>
                <p className="truncate text-sm text-ink-40">{supplier.faculty}</p>
              </div>
              <button
                type="button"
                onClick={() => setSupplierId('')}
                className="min-h-[44px] shrink-0 px-2 py-2 text-sm font-medium text-blue hover:underline md:min-h-0"
              >
                Change
              </button>
            </div>
          ) : (
            <select
              id="supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="mt-2 h-12 w-full rounded-btn border border-line bg-surface px-3 text-base text-ink"
            >
              <option value="">Choose a stall</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {qualifiedName(s)}
                </option>
              ))}
            </select>
          )}
        </section>

        {/* 2. What do you need? */}
        <section>
          {label('What do you need?', 'description')}
          <textarea
            id="description"
            rows={4}
            maxLength={MAX_CHARS}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. 1x chicken rice, no cucumber, chilli separate."
            className="mt-2 w-full resize-none rounded-btn border border-line bg-surface p-3 text-base text-ink"
          />
          <div className="mt-1.5 flex items-start justify-between gap-4">
            <p className="max-w-prose text-sm text-ink-40">
              Be specific. Your courier is buying this for you, so mention anything that matters.
            </p>
            <span className="tnum shrink-0 text-sm text-ink-40">
              {description.length}/{MAX_CHARS}
            </span>
          </div>
        </section>

        {/* 3. Deliver to */}
        <section>
          {label('Deliver to', 'location')}
          {/* Delivery locations are the Supplier Service's location reference list (ids). */}
          <select
            id="location"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="mt-2 h-12 w-full rounded-btn border border-line bg-surface px-3 text-base text-ink"
          >
            <option value="">Choose a drop-off point</option>
            {locations.map((l) => (
              <option key={l.location_id} value={l.location_id}>
                {l.location}
              </option>
            ))}
          </select>
        </section>

        {/* 4. Post time: optional. When the request is sent out to the board.
            Hidden for now (George, 2026-10-20); restore postMode/postDate/postTime state with it.
        <section>
          <span className="block text-base font-semibold text-ink">
            When should this go out?{' '}
            <span className="font-normal text-ink-40">Optional</span>
          </span>
          <div className="mt-2 inline-flex w-full rounded-btn border border-line p-1">
            {[
              ['now', 'Send it out now'],
              ['schedule', 'Schedule for later'],
            ].map(([value, text]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPostMode(value)}
                aria-pressed={postMode === value}
                className={
                  'h-11 md:h-10 flex-1 rounded-[7px] px-3 text-sm font-medium transition-colors duration-150 ' +
                  (postMode === value ? 'bg-ink text-white' : 'text-ink-70 hover:text-ink')
                }
              >
                {text}
              </button>
            ))}
          </div>
          {postMode === 'schedule' && (
            <div className="foc-fade mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm text-ink-70">Date</span>
                <input
                  type="date"
                  value={postDate}
                  onChange={(e) => setPostDate(e.target.value)}
                  className="mt-1 h-12 w-full rounded-btn border border-line bg-surface px-3 text-base text-ink"
                />
              </label>
              <label className="block">
                <span className="text-sm text-ink-70">Time</span>
                <input
                  type="time"
                  value={postTime}
                  onChange={(e) => setPostTime(e.target.value)}
                  className="mt-1 h-12 w-full rounded-btn border border-line bg-surface px-3 text-base text-ink"
                />
              </label>
            </div>
          )}
          <p className="mt-1.5 max-w-prose text-sm text-ink-40">
            {postMode === 'schedule'
              ? 'Nobody sees this errand until then. It appears on the board at that time and the countdown below starts from there.'
              : 'Your errand goes on the board as soon as you post it.'}
          </p>
        </section> */}

        {/* 5. Complete-by: the deadline for the food to arrive. */}
        <section>
          <span className="block text-base font-semibold text-ink">
            When do you need it by?
          </span>
          <div className="mt-2 inline-flex w-full rounded-btn border border-line p-1">
            {[
              ['asap', 'As soon as possible'],
              ['later', 'By a specific time'],
            ].map(([value, text]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTiming(value)}
                aria-pressed={timing === value}
                className={
                  'h-11 md:h-10 flex-1 rounded-[7px] px-3 text-sm font-medium transition-colors duration-150 ' +
                  (timing === value ? 'bg-ink text-white' : 'text-ink-70 hover:text-ink')
                }
              >
                {text}
              </button>
            ))}
          </div>
          {timing === 'later' && (
            <div className="foc-fade mt-3 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm text-ink-70">Date</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 h-12 w-full rounded-btn border border-line bg-surface px-3 text-base text-ink"
                />
              </label>
              <label className="block">
                <span className="text-sm text-ink-70">Time</span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="mt-1 h-12 w-full rounded-btn border border-line bg-surface px-3 text-base text-ink"
                />
              </label>
            </div>
          )}
          <p className="mt-1.5 max-w-prose text-sm text-ink-40">
            This is when the food should reach you. Your courier sees it before accepting.
          </p>
        </section>

        {/* 6. Expiration: how long the request stays on the board unaccepted.
            Hidden for now (George, 2026-10-20); restore EXPIRY_CHOICES, expiry state and
            deadlineTooTight with it.
        <section>
          <span className="block text-base font-semibold text-ink">
            How long should this stay open?
          </span>
          <div className="hide-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            {EXPIRY_CHOICES.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setExpiry(mins)}
                aria-pressed={expiry === mins}
                className={
                  'h-11 md:h-10 shrink-0 rounded-pill border px-4 text-sm font-medium transition-colors duration-150 ' +
                  (expiry === mins
                    ? 'border-ink bg-ink text-white'
                    : 'border-line bg-surface text-ink-70 hover:border-ink hover:text-ink')
                }
              >
                {mins < 60 ? mins + ' min' : mins / 60 + (mins === 60 ? ' hour' : ' hours')}
              </button>
            ))}
          </div>
          <p className="mt-1.5 max-w-prose text-sm text-ink-40">
            If nobody accepts it within{' '}
            {expiry < 60 ? expiry + ' minutes' : expiry / 60 + (expiry === 60 ? ' hour' : ' hours')}{' '}
            {postMode === 'schedule' ? 'of it going out' : 'of posting'}, the errand expires and
            your reserved credits come straight back.
          </p>
          {deadlineTooTight && (
            <p className="mt-1.5 max-w-prose text-sm text-alert">
              This errand could still be unaccepted at {time}. Shorten how long it stays open, or
              give a later time to deliver by.
            </p>
          )}
        </section> */}

        {/* 7. Offer: fixed once posted, so not shown when editing. */}
        {!isEdit && (
          <section>
            <span className="block text-base font-semibold text-ink">Offer</span>
            <div
              className={
                'mt-2 inline-flex h-16 items-center gap-6 rounded-btn border px-4 ' +
                (insufficient ? 'border-alert' : 'border-line')
              }
            >
              <button
                type="button"
                onClick={() => setOffer((v) => Math.max(1, v - 1))}
                disabled={offer <= 1}
                aria-label="Offer one credit fewer"
                className="flex h-11 w-11 items-center justify-center rounded-pill border border-line text-ink disabled:text-ink-40"
              >
                <Minus size={18} aria-hidden="true" />
              </button>
              <span className="tnum min-w-[3ch] text-center text-2xl font-semibold text-ink">
                {offer}
              </span>
              <button
                type="button"
                onClick={() => setOffer((v) => Math.min(10, v + 1))}
                disabled={offer >= 10}
                aria-label="Offer one credit more"
                className="flex h-11 w-11 items-center justify-center rounded-pill border border-line text-ink disabled:text-ink-40"
              >
                <Plus size={18} aria-hidden="true" />
              </button>
            </div>

            {insufficient ? (
              /* Credit F1.2.2 — insufficient credits. */
              <p className="mt-2 max-w-prose text-sm text-alert">
                You have <span className="tnum">{credits.total}</span> credits,{' '}
                <span className="tnum">{credits.reserved}</span> of them reserved. Lower your offer or
                wait for an errand to complete.
              </p>
            ) : (
              <p className="mt-2 text-sm text-ink-40">
                After posting, you&rsquo;ll have <span className="tnum">{remaining}</span> of{' '}
                <span className="tnum">{credits.available}</span> credits available.
              </p>
            )}
          </section>
        )}

        {/* 8. Anything else? */}
        <section>
          {label('Anything else?', 'extra')}
          <input
            id="extra"
            type="text"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder="Meet at the side entrance, I'm in a lecture until 3."
            className="mt-2 h-12 w-full rounded-btn border border-line bg-surface px-3 text-base text-ink"
          />
        </section>
      </div>

      {/* Footer bar: sticky to the viewport on mobile. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface p-4 md:static md:mt-10 md:p-0 md:pt-6">
        <div className="page-gutter mx-auto flex max-w-[640px] flex-col gap-3 md:flex-row md:items-center md:justify-between md:px-0">
          <div className="space-y-1">
            <p className="max-w-prose text-sm text-ink-70">
              {isEdit ? (
                'Update the details of this open errand.'
              ) : (
                <>
                  <span className="tnum">{offer}</span> credits will be reserved until this errand
                  is completed or cancelled
                </>
              )}
            </p>
            {postError && (
              <p role="alert" className="max-w-prose text-sm text-alert">
                {postError}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" className="flex-1 md:flex-none" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button
              className="flex-1 md:flex-none"
              disabled={insufficient || !complete || posting}
              onClick={isEdit ? onSave : onPost}
            >
              {posting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {isEdit ? (posting ? 'Saving…' : 'Save changes') : posting ? 'Posting…' : 'Post errand'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
