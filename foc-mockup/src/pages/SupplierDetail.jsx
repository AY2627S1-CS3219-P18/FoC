/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5), date: 2026-09-08
 * Scope: Generated UI mockup component SupplierDetail.jsx from team-authored blueprint.md.
 *        Visual/layout implementation only. No requirements, architecture, or
 *        schema decisions were made by the AI tool.
 * Author review: <pending — team member to sign>
 */

import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import SupplierImage from '../components/SupplierImage'
import SupplierCard from '../components/SupplierCard'
import Button from '../components/Button'
import { getSupplier, stallsAtVenue, qualifiedName } from '../data/suppliers'
import { useDemo } from '../context/DemoContext'

// Stall detail. The supplier entity is the stall (team decision), so this page is one
// supplier row. If the stall sits in a venue, the other stalls in that venue are listed as a
// view over the flat list. Display only — no menus, no items, no cart.
export default function SupplierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { requireLogin } = useDemo()

  const supplier = getSupplier(id)
  if (!supplier) return <Navigate to="/suppliers" replace />

  const siblings = stallsAtVenue(supplier)

  const requestFromHere = () =>
    requireLogin('You need an account to post an errand.', () =>
      navigate('/requests/new?supplier=' + supplier.id),
    )

  return (
    <div className="page-width page-gutter py-6 md:py-8">
      <Link
        to="/suppliers"
        className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-ink-70 hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        All suppliers
      </Link>

      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_320px] md:gap-10">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-card border border-line">
            <SupplierImage supplier={supplier} ratio="aspect-[16/9]" />
          </div>

          <h1 className="font-display mt-6 text-2xl font-bold text-ink md:text-3xl">
            {supplier.name}
          </h1>
          <p className="mt-1.5 text-base text-ink-40">
            {supplier.venue ? supplier.venue + ' · ' : ''}
            {supplier.location} · {supplier.category}
          </p>

          <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-sm">
            <span
              className={
                'inline-block h-2 w-2 shrink-0 rounded-pill ' +
                (supplier.isOpen ? 'bg-blue' : 'border border-ink-40')
              }
              aria-hidden="true"
            />
            <span className={supplier.isOpen ? 'text-ink-70' : 'text-ink-40'}>
              {supplier.isOpen
                ? 'Open until ' + supplier.hours.close
                : 'Closed · opens ' + supplier.hours.open}
            </span>
            {supplier.activeRequests > 0 && (
              <span className="text-ink-70">
                · {supplier.activeRequests} open{' '}
                {supplier.activeRequests === 1 ? 'errand' : 'errands'}
              </span>
            )}
          </p>

          <p className="mt-4 max-w-prose text-base text-ink-70">{supplier.description}</p>
        </div>

        {/* Desktop: the action sits alongside. Mobile: it follows the header. */}
        <aside className="md:pt-2">
          <div className="card p-4">
            <p className="text-sm text-ink-70">
              Tell your courier what you want in your own words — there is no menu to pick from.
            </p>
            <Button size="lg" className="mt-4 w-full" onClick={requestFromHere}>
              Request from here
            </Button>
          </div>
        </aside>
      </div>

      {siblings.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-ink">Also at {supplier.venue}</h2>
          <p className="mt-1 text-sm text-ink-40">
            Other stalls in the same venue. Each one is its own supplier.
          </p>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {siblings.map((stall) => (
              <SupplierCard key={stall.id} supplier={stall} />
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
