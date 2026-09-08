/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5), date: 2026-09-08
 * Scope: Generated UI mockup component Suppliers.jsx from team-authored blueprint.md.
 *        Visual/layout implementation only. No requirements, architecture, or
 *        schema decisions were made by the AI tool.
 * Author review: <pending — team member to sign>
 */

import { useMemo, useState } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import SupplierCard from '../components/SupplierCard'
import Button from '../components/Button'
import EmptyState from '../components/EmptyState'
import {
  suppliers,
  categories,
  groupByVenue,
  venueOpenSummary,
  matchesQuery,
} from '../data/suppliers'

const SORTS = ['A–Z', 'Most errands', 'Open first']
const venues = [...new Set(suppliers.map((s) => s.venue).filter(Boolean))]

// Supplier F1.1 listing, F1.1.1 search and filter, F1.2.1 open/closed indicator.
export default function Suppliers() {
  const [query, setQuery] = useState('')
  const [cats, setCats] = useState([])
  const [openNow, setOpenNow] = useState(false)
  const [vens, setVens] = useState([])
  const [sort, setSort] = useState(SORTS[0])
  const [sheetOpen, setSheetOpen] = useState(false)

  const toggle = (list, setList, value) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  const results = useMemo(() => {
    const filtered = suppliers.filter((s) => {
      if (!matchesQuery(s, query)) return false
      if (cats.length && !cats.includes(s.category)) return false
      if (openNow && !s.isOpen) return false
      if (vens.length && !vens.includes(s.venue)) return false
      return true
    })
    const sorted = [...filtered]
    if (sort === 'A–Z') sorted.sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'Most errands') sorted.sort((a, b) => b.activeRequests - a.activeRequests)
    if (sort === 'Open first') sorted.sort((a, b) => Number(b.isOpen) - Number(a.isOpen))
    return sorted
  }, [query, cats, openNow, vens, sort])

  const grouped = groupByVenue(results)

  const checkbox = (label, checked, onChange) => (
    <label key={label} className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-sm text-ink-70">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 rounded-[4px] border-line text-ink focus:ring-blue"
      />
      <span>{label}</span>
    </label>
  )

  const filterPanel = (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-ink">Category</h3>
        <div className="mt-1">
          {categories.map((c) => checkbox(c, cats.includes(c), () => toggle(cats, setCats, c)))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-ink">Availability</h3>
        <div className="mt-1">{checkbox('Open now', openNow, () => setOpenNow((v) => !v))}</div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-ink">Venue</h3>
        <div className="mt-1">
          {venues.map((v) => checkbox(v, vens.includes(v), () => toggle(vens, setVens, v)))}
        </div>
      </div>
    </div>
  )

  const sortSelect = (
    <label className="flex items-center gap-2 text-sm text-ink-70">
      <span className="shrink-0">Sort</span>
      <select
        value={sort}
        onChange={(e) => setSort(e.target.value)}
        className="h-11 cursor-pointer rounded-btn border border-line bg-surface px-2 text-sm text-ink md:h-10"
      >
        {SORTS.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="page-width page-gutter py-8 md:py-10">
      <h1 className="font-display text-2xl font-bold text-ink md:text-3xl">Suppliers</h1>

      <div className="mt-6 flex gap-8">
        <aside className="hidden w-[220px] shrink-0 lg:block">
          <h2 className="text-base font-semibold text-ink">Filters</h2>
          <div className="mt-4">{filterPanel}</div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-40"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stalls, venues, or faculties"
              aria-label="Search suppliers"
              className="h-12 w-full rounded-btn border border-line bg-surface pl-11 pr-4 text-base text-ink"
            />
          </div>

          {/* Sticky filter/sort bar under the nav on small screens. */}
          <div className="sticky top-16 z-30 -mx-4 mt-4 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 lg:static lg:mx-0 lg:border-0 lg:px-0">
            <p className="text-sm text-ink-70">
              <span className="tnum font-medium text-ink">{results.length}</span>{' '}
              {results.length === 1 ? 'stall' : 'stalls'} on campus
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="lg:hidden"
                onClick={() => setSheetOpen(true)}
              >
                <SlidersHorizontal size={15} aria-hidden="true" />
                Filters
              </Button>
              {sortSelect}
            </div>
          </div>

          {/* A view over the flat list: venues first, then stalls with no venue. */}
          {grouped.groups.map((group) => (
            <section key={group.venue} className="mt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-base font-semibold text-ink">{group.venue}</h2>
                <p className="text-sm text-ink-40">
                  <span className="tnum">{group.items.length}</span>{' '}
                  {group.items.length === 1 ? 'stall' : 'stalls'} ·{' '}
                  {venueOpenSummary(group.items)}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {group.items.map((s) => (
                  <SupplierCard key={s.id} supplier={s} />
                ))}
              </div>
            </section>
          ))}

          {grouped.standalone.length > 0 && (
            <section className="mt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-base font-semibold text-ink">On their own</h2>
                <p className="text-sm text-ink-40">Stalls that are not inside a venue</p>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {grouped.standalone.map((s) => (
                  <SupplierCard key={s.id} supplier={s} />
                ))}
              </div>
            </section>
          )}

          {results.length === 0 && (
            <div className="mt-5">
              <EmptyState
                title="No stalls match those filters"
                body="Try clearing a filter, or search for a venue like The Deck."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setQuery('')
                      setCats([])
                      setVens([])
                      setOpenNow(false)
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSheetOpen(false)}
          />
          <div className="foc-fade absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-card bg-surface p-5 shadow-modal">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Filters</h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-btn text-ink"
                aria-label="Close filters"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4">{filterPanel}</div>
            <Button size="lg" className="mt-6 w-full" onClick={() => setSheetOpen(false)}>
              Show {results.length} places
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
