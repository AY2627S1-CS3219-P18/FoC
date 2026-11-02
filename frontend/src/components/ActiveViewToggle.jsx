/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-10-23
 * Scope: Created the requester/courier view toggle, per instructions.md Stage 16f. Reads
 *        AuthContext.user.activeView and calls AuthContext.setActiveView, which already does
 *        the optimistic update + revert-on-failure (built in Stage 16b in anticipation of this
 *        sub-stage); this component only renders the two segments and shows a toast on the
 *        error setActiveView rethrows.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { useState } from 'react'
import { Bike, ShoppingBag } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from './Toast'
import { describeError } from '../api/errorMessages'

const VIEWS = [
  { value: 'requester', label: 'Requester', icon: ShoppingBag },
  { value: 'courier', label: 'Courier', icon: Bike },
]

export default function ActiveViewToggle({ className = '' }) {
  const { user, setActiveView } = useAuth()
  const { showToast } = useToast()
  const [pending, setPending] = useState(false)

  if (!user) return null

  const select = async (value) => {
    if (value === user.activeView || pending) return
    setPending(true)
    try {
      await setActiveView(value)
    } catch (err) {
      showToast(describeError(err).message, 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      role="group"
      aria-label="Requester or courier view"
      className={'flex items-center gap-1 rounded-btn bg-surface-alt p-1 ' + className}
    >
      {VIEWS.map(({ value, label, icon: Icon }) => {
        const active = user.activeView === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            disabled={pending}
            onClick={() => select(value)}
            className={
              'flex h-8 items-center gap-1.5 rounded-btn px-3 text-xs font-medium transition-colors duration-150 disabled:opacity-60 ' +
              (active ? 'bg-ink text-white' : 'text-ink-70 hover:text-ink')
            }
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
