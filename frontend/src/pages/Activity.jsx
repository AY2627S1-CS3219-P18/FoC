/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5), date: 2026-09-08
 * Scope: Generated UI mockup component Activity.jsx from team-authored blueprint.md.
 *        Visual/layout implementation only. No requirements, architecture, or
 *        schema decisions were made by the AI tool.
 * Author review: <pending — team member to sign>
 *
 * Tool: Copilot SDK (model: unspecified by runtime), date: 2026-10-20
 * Scope: Replaced DemoContext request data with live Order Service orders, loaded supplier details
 *        from the Supplier Service, and connected status actions to Order Service transitions.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 */

/*
 * AI Assistance Disclosure:
 * Tool: Copilot SDK (model: unspecified by runtime), date: 2026-10-20
 * Scope: Wired the existing requester Edit action to the order edit page.
 * No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: tng wen xi
 *
 * Tool: Claude Code (model: claude-opus-5-5), date: 2026-10-20
 * Scope: Order Service frontend integration (#6) - My errands come from GET /orders/mine
 *        (pending hidden), My deliveries from GET /orders/active plus the closed ones from
 *        GET /orders/mine?as=courier; pick up, deliver, complete and cancel call their
 *        POST /orders/:id/<action> routes and show the service's rejection; the lists refetch
 *        on order events and after a socket reconnect. Supplier, names and locations resolve
 *        from ids; timeline stamps use createdAt / acceptedAt / deliveredAt. Cancel on an
 *        accepted or picked-up errand appears once its deliver-by time has passed (F17.2).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): Edit opens /requests/:id/edit (Wen Xi's edit page, carried over).
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 * Scope (2026-10-20): Rebased onto PR #115. George chose to keep this implementation, so the
 *        version of this file described in Wen Xi's entries above was replaced.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bike, ShoppingBag } from 'lucide-react'
import SupplierImage from '../components/SupplierImage'
import StatusChip from '../components/StatusChip'
import CreditPill from '../components/CreditPill'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import { useApiNotice } from '../components/ApiNotice'
import { useDemo } from '../context/DemoContext'
import { qualifiedName } from '../data/suppliers'
import { LIFECYCLE, LIFECYCLE_LABELS, clockTime, completeByShort } from '../data/requests'
import { useApi } from '../api/useApi'
import { useLocationNames, useSupplier, useUserName } from '../api/lookups'
import {
  cancelOrder,
  completeOrder,
  deliverOrder,
  listActiveDeliveries,
  listMyOrders,
  orderErrorMessage,
  pickupOrder,
} from '../api/orders'
import { useOrderEvents, useSocketReady } from '../realtime/orderSocket'

const CLOSED = ['completed', 'cancelled', 'expired']
const ACTIVE = ['open', 'accepted', 'picked_up', 'delivered']
// A courier and a requester can only talk while the errand is still in flight.
const MESSAGEABLE = ['accepted', 'picked_up', 'delivered']
const ROLE_REQUESTER = 'You requested'
const ROLE_COURIER = 'You are delivering'
const ACTIONS = {
  pickup: pickupOrder,
  deliver: deliverOrder,
  complete: completeOrder,
  cancel: cancelOrder,
}

async function loadActivity() {
  const [mine, active, delivered] = await Promise.all([
    listMyOrders('requester'),
    listActiveDeliveries(),
    listMyOrders('courier'),
  ])
  return {
    // `pending` is still waiting for its credits and stays hidden until it opens.
    errands: mine.orders.filter((o) => o.status !== 'pending'),
    deliveries: [
      ...active.orders,
      ...delivered.orders.filter((o) => CLOSED.includes(o.status)),
    ],
  }
}

// Order F3.4.2 active requests, F5 cancellation, F6 editing, F1.4.1 / F4.1.3 credit outcomes.
export default function Activity() {
  const { role, isLoggedIn, requireLogin } = useDemo()

  // Gated when logged out (§9): the page stays visible behind the scrim.
  useEffect(() => {
    if (!isLoggedIn) requireLogin('You need an account to see your activity.')
  }, [isLoggedIn, requireLogin])
  const [tab, setTab] = useState(role === 'courier' ? 'deliveries' : 'errands')
  const { data, loading, error, reload } = useApi(loadActivity, [])
  // Orders returned by an action, shown until the next fetch replaces `data`.
  const [changed, setChanged] = useState({ data: null, orders: {} })
  const notice = useApiNotice({ loading: loading && !data, error }, 'your activity')
  const locationName = useLocationNames()

  // Thin events: refetch (once per burst) when one concerns this user's orders. The server only
  // sends this socket events for orders it is part of, plus the board feed when subscribed.
  const refetchTimer = useRef(null)
  const refetch = useCallback(() => {
    clearTimeout(refetchTimer.current)
    refetchTimer.current = setTimeout(reload, 200)
  }, [reload])
  useEffect(() => () => clearTimeout(refetchTimer.current), [])
  useOrderEvents(refetch)
  useSocketReady(refetch)

  const overrides = changed.data === data ? changed.orders : {}
  const withChanges = (orders = []) => orders.map((o) => overrides[o.id] ?? o)
  const mine = withChanges(data?.errands)
  const deliveries = withChanges(data?.deliveries)
  const list = tab === 'errands' ? mine : deliveries
  const active = list.filter((r) => ACTIVE.includes(r.status))
  const history = list.filter((r) => CLOSED.includes(r.status))

  const runAction = async (action, id) => {
    const { order } = await ACTIONS[action](id)
    setChanged((c) => ({
      data,
      orders: { ...(c.data === data ? c.orders : {}), [order.id]: order },
    }))
    refetch()
  }

  // One live item per tab; everything finished drops into History with no actions left on it.
  const section = (heading, items, asCourier) =>
    items.length > 0 && (
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-40">{heading}</h2>
        <div className="mt-3 space-y-4">
          {items.map((request) => (
            <ActivityCard
              key={request.id}
              request={request}
              asCourier={asCourier}
              locationName={locationName(request.deliveryLocationId)}
              runAction={runAction}
            />
          ))}
        </div>
      </section>
    )

  return (
    <div className="page-width page-gutter py-8 md:py-10">
      <h1 className="font-display text-2xl font-bold text-ink md:text-3xl">My activity</h1>

      <div className="mt-6 flex w-full rounded-btn border border-line p-1 md:inline-flex md:w-auto">
        {[
          ['errands', 'My errands', mine.length],
          ['deliveries', 'My deliveries', deliveries.length],
        ].map(([value, text, count]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-pressed={tab === value}
            className={
              'h-11 md:h-10 flex-1 rounded-[7px] px-4 text-sm font-medium transition-colors duration-150 md:flex-none ' +
              (tab === value ? 'bg-ink text-white' : 'text-ink-70 hover:text-ink')
            }
          >
            {text} <span className="tnum opacity-60">({count})</span>
          </button>
        ))}
      </div>

      {notice}

      {!notice && section('Active now', active, tab === 'deliveries')}
      {!notice && section('History', history, tab === 'deliveries')}

      {!notice && list.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title={tab === 'errands' ? 'No errands yet' : 'No deliveries yet'}
            body={
              tab === 'errands'
                ? 'Errands you post will show up here with their progress.'
                : 'Errands you accept will show up here.'
            }
          />
        </div>
      )}
    </div>
  )
}

function ActivityCard({ request, asCourier, locationName, runAction }) {
  const navigate = useNavigate()
  const supplier = useSupplier(request.supplierId)
  const other = useUserName(asCourier ? request.requesterId : request.courierId)
  const [busy, setBusy] = useState(null)
  const [actionError, setActionError] = useState(null)
  const dimmed = request.status === 'cancelled' || request.status === 'expired'
  const showTimeline = !CLOSED.includes(request.status)
  const canMessage = Boolean(request.courierId) && MESSAGEABLE.includes(request.status)
  // F17.2: an ongoing errand can be cancelled by its requester only after its deliver-by time.
  const [loadedAt] = useState(() => Date.now())
  const pastDeadline = Boolean(request.completeBy) && Date.parse(request.completeBy) <= loadedAt
  const supplierName = qualifiedName(supplier) || 'Supplier #' + request.supplierId

  const act = (action) => async () => {
    setBusy(action)
    setActionError(null)
    try {
      await runAction(action, request.id)
    } catch (err) {
      setActionError(orderErrorMessage(err, action))
    } finally {
      setBusy(null)
    }
  }
  const actionButton = (action, text, variant = 'primary') => (
    <Button variant={variant} size="sm" disabled={busy !== null} onClick={act(action)}>
      {busy === action ? 'Working…' : text}
    </Button>
  )

  const messageButton = canMessage && (
    <Button variant="secondary" size="sm" onClick={() => navigate('/chat/' + request.id)}>
      Message {other ?? (asCourier ? 'requester' : 'courier')}
    </Button>
  )

  const actions = () => {
    if (!asCourier) {
      if (request.status === 'open') {
        return (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/requests/' + request.id + '/edit')}
            >
              Edit
            </Button>
            {actionButton('cancel', 'Cancel errand', 'danger')}
          </div>
        )
      }
      if (request.status === 'accepted' || request.status === 'picked_up') {
        if (!pastDeadline) return messageButton
        return (
          <div className="flex flex-wrap gap-2">
            {messageButton}
            {actionButton('cancel', 'Cancel errand', 'danger')}
          </div>
        )
      }
      if (request.status === 'delivered') {
        return (
          <div className="flex flex-col items-start gap-1.5">
            <div className="flex flex-wrap gap-2">
              {actionButton('complete', 'Confirm and release credits')}
              {messageButton}
            </div>
            <span className="text-sm text-ink-40">
              <span className="tnum">{request.credits}</span> credits will move to{' '}
              {other ?? 'your courier'} when you confirm.
            </span>
          </div>
        )
      }
      return null
    }

    if (request.status === 'accepted') {
      return (
        <div className="flex flex-wrap gap-2">
          {actionButton('pickup', 'Mark picked up')}
          {messageButton}
        </div>
      )
    }
    if (request.status === 'picked_up') {
      return (
        <div className="flex flex-wrap gap-2">
          {actionButton('deliver', 'Mark delivered')}
          {messageButton}
        </div>
      )
    }
    if (request.status === 'delivered') {
      return (
        <div className="flex flex-wrap items-center gap-3">
          {messageButton}
          <span className="text-sm text-ink-40">Waiting for requester to confirm</span>
        </div>
      )
    }
    return null
  }

  return (
    <article
      className={
        /* Role is colour-coded on the left edge: blue = you asked for it,
           orange = you are running it. */
        'card border-l-[3px] p-4 ' +
        (asCourier ? 'border-l-orange ' : 'border-l-blue ') +
        (dimmed ? 'opacity-60' : '')
      }
    >
      <div className="flex gap-3 sm:gap-4">
        <div className="w-16 shrink-0 sm:w-[72px]">
          <SupplierImage supplier={supplier} ratio="aspect-square" rounded="rounded-[10px]" compact />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-ink">{supplierName}</h2>
            <StatusChip status={request.status} />
            <span className="inline-flex h-6 items-center gap-1 rounded-pill bg-surface-alt px-2.5 text-xs font-medium text-ink-70">
              {asCourier ? (
                <Bike size={12} aria-hidden="true" />
              ) : (
                <ShoppingBag size={12} aria-hidden="true" />
              )}
              {asCourier ? ROLE_COURIER : ROLE_REQUESTER}
            </span>
          </div>
          <p className="mt-1.5 max-w-prose text-base text-ink">{request.description}</p>
          <p className="mt-1 text-sm text-ink-40">
            <span aria-hidden="true">&rarr;</span> {locationName}
            {other && (asCourier ? ' · for ' + other : ' · courier ' + other)}
          </p>
          {/* The delivery deadline stays visible for as long as the errand is live. */}
          {!CLOSED.includes(request.status) && (
            <p className="mt-1 text-sm text-ink-70">
              Deliver by <span className="tnum">{completeByShort(request.completeBy)}</span>
            </p>
          )}

          {dimmed && !asCourier && (
            <p className="mt-1.5 text-sm text-ink-40">
              <span className="tnum">{request.credits}</span> credits returned to your balance.
            </p>
          )}
        </div>

        <div className="shrink-0">
          <CreditPill value={request.credits} size="sm" />
        </div>
      </div>

      {showTimeline && <Timeline request={request} />}

      {actions() && <div className="mt-4 border-t border-line pt-4">{actions()}</div>}
      {actionError && (
        <p role="alert" className="mt-2 text-sm text-alert">
          {actionError}
        </p>
      )}
    </article>
  )
}

function Timeline({ request }) {
  const currentIndex = LIFECYCLE.indexOf(request.status)
  // Only these steps are time-stamped by the Order Service.
  const timeline = {
    open: request.createdAt,
    accepted: request.acceptedAt,
    delivered: request.deliveredAt,
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      {/* Desktop: horizontal. Mobile: the same steps rotate to a vertical rail. */}
      {/* All steps share a width so each connector spans exactly one dot-to-dot gap.
          With an uneven last cell the final connector overshoots the card. */}
      <ol className="hidden sm:flex">
        {LIFECYCLE.map((step, i) => {
          const done = i < currentIndex
          const current = i === currentIndex
          const stamp = timeline[step]
          return (
            <li key={step} className="relative flex flex-1 flex-col items-center">
              {i < LIFECYCLE.length - 1 && (
                <span
                  className={
                    'absolute left-1/2 top-[5px] h-0.5 w-full ' + (done ? 'bg-ink' : 'bg-line')
                  }
                  aria-hidden="true"
                />
              )}
              <span
                className={
                  'relative z-10 h-3 w-3 rounded-pill ' +
                  (done
                    ? 'bg-ink'
                    : current
                      ? 'bg-surface ring-2 ring-orange'
                      : 'border border-line bg-surface')
                }
                aria-hidden="true"
              />
              <span
                className={
                  'mt-2 text-center text-xs ' + (done || current ? 'text-ink-70' : 'text-ink-40')
                }
              >
                {LIFECYCLE_LABELS[step]}
              </span>
              <span className="tnum mt-0.5 h-4 text-center text-xs text-ink-40">
                {stamp ? clockTime(stamp) : ''}
              </span>
            </li>
          )
        })}
      </ol>

      <ol className="sm:hidden">
        {LIFECYCLE.map((step, i) => {
          const done = i < currentIndex
          const current = i === currentIndex
          const stamp = timeline[step]
          return (
            <li key={step} className="relative flex gap-3 pb-3 last:pb-0">
              {i < LIFECYCLE.length - 1 && (
                <span
                  className={
                    'absolute left-[5px] top-3 h-full w-0.5 ' + (done ? 'bg-ink' : 'bg-line')
                  }
                  aria-hidden="true"
                />
              )}
              <span
                className={
                  'relative z-10 mt-1 h-3 w-3 shrink-0 rounded-pill ' +
                  (done
                    ? 'bg-ink'
                    : current
                      ? 'bg-surface ring-2 ring-orange'
                      : 'border border-line bg-surface')
                }
                aria-hidden="true"
              />
              <span className="flex flex-1 items-baseline justify-between gap-3">
                <span className={'text-sm ' + (done || current ? 'text-ink-70' : 'text-ink-40')}>
                  {LIFECYCLE_LABELS[step]}
                </span>
                <span className="tnum text-xs text-ink-40">{stamp ? clockTime(stamp) : ''}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
