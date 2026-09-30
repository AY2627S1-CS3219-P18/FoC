/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5), date: 2026-09-08
 * Scope: Generated UI mockup component Landing.jsx from team-authored blueprint.md.
 *        Visual/layout implementation only. No requirements, architecture, or
 *        schema decisions were made by the AI tool.
 * Author review: <pending — team member to sign>
 *
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Reads the API-contract supplier fields: category chips from the category reference, grouping by location, and no separate 'On their own' group (every supplier has a location). No requirements, architecture, schema, or API decisions were made by
 *        the AI tool.
 * Author review: Congchen
  *
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: Supplier objects now carry location_id, faculty_id and categories as {category, category_id} objects. Per the team's decision in chat;
 *        no other requirements, architecture, schema, or API decisions were made by the
 *        AI tool.
 * Author review: Congchen
  *
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: The landing supplier list and category chips now load from the Supplier Service (list and category reference endpoints) instead of mock data. No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: Congchen
  *
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-09-30
 * Scope: The list query depends on the category id (a number) rather than the options array. No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review: Congchen
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import SupplierCard from '../components/SupplierCard'
import { useApiNotice } from '../components/ApiNotice'
import { useApi, useReferenceData } from '../api/useApi'
import { listSuppliers } from '../api/suppliers'
import { groupByLocation, locationOpenSummary } from '../data/suppliers'

// User F2 / Supplier F1.1 — the supplier list comes from GET /api/v1/suppliers, which needs a login.
export default function Landing() {
  const navigate = useNavigate()
  const [chip, setChip] = useState('All')
  const { categories } = useReferenceData()
  const chips = ['All', ...categories.map((c) => c.category), 'Open now']

  // One chip at a time: a category chip filters by category_id, 'Open now' by isOpen.
  const categoryId = categories.find((c) => c.category === chip)?.category_id
  const query = useMemo(
    () => ({
      category_id: categoryId,
      isOpen: chip === 'Open now' ? 'true' : undefined,
      sortOrder: 'A-Z',
    }),
    [chip, categoryId],
  )
  const { data, loading, error } = useApi(() => listSuppliers(query), [query])
  const notice = useApiNotice({ loading, error })

  const grouped = groupByLocation(data?.data ?? [])

  return (
    <>
      <section className="page-width page-gutter pb-8 pt-12 md:pt-16">
        <div className="foc-rise">
          <h1 className="font-display max-w-[14ch] text-2xl font-bold text-ink md:text-4xl">
            Get it fetched.
          </h1>
          <p className="mt-3 max-w-prose text-base text-ink-70 md:text-lg">
            Someone&rsquo;s already heading there.
          </p>
        </div>
      </section>

      <section className="page-width page-gutter">
        <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChip(c)}
              aria-pressed={chip === c}
              className={
                'h-11 md:h-10 shrink-0 rounded-pill border px-4 text-sm font-medium transition-colors duration-150 ' +
                (chip === c
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-surface text-ink-70 hover:border-ink hover:text-ink')
              }
            >
              {c}
            </button>
          ))}

          {/* Not a filter: hands the visitor to the full search and filter screen. */}
          <button
            type="button"
            onClick={() => navigate('/suppliers')}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-pill border border-ink bg-surface px-4 text-sm font-medium text-ink transition-colors duration-150 hover:bg-surface-alt md:h-10"
          >
            <Search size={15} aria-hidden="true" />
            Search stalls
          </button>
        </div>

        <h2 className="mt-8 text-xl font-semibold text-ink">Places to fetch from on campus</h2>
        <p className="mt-1 text-sm text-ink-40">
          Every card is one supplier you can order from. Suppliers that share a location are
          listed together.
        </p>

        {notice}

        {/* Grouping by location is a view over the flat supplier list, not a parent-child
            relationship in the data. */}
        {!notice && grouped.map((group) => (
          <section key={group.location} className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-base font-semibold text-ink">{group.location}</h3>
              <p className="text-sm text-ink-40">
                <span className="tnum">{group.items.length}</span>{' '}
                {group.items.length === 1 ? 'supplier' : 'suppliers'} ·{' '}
                {locationOpenSummary(group.items)}
              </p>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {group.items.map((s) => (
                <SupplierCard
                  key={s.id}
                  supplier={s}
                  ratio="aspect-[16/9] sm:aspect-[4/3]"
                  showAction={false}
                />
              ))}
            </div>
          </section>
        ))}
      </section>

      <section className="mt-16 border-y border-line bg-surface-alt">
        <div className="page-width page-gutter grid gap-6 py-12 md:grid-cols-2 md:gap-16">
          <h2 className="font-display text-xl font-semibold text-ink md:text-2xl">
            How credits work
          </h2>
          <div className="max-w-prose space-y-3 text-base text-ink-70">
            <p>You start with 20 credits. Run an errand, earn credits. Post one, spend them.</p>
            <p>Credits stay inside FoC — they&rsquo;re not money and can&rsquo;t be cashed out.</p>
          </div>
        </div>
      </section>
    </>
  )
}
