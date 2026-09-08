/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5), date: 2026-09-08
 * Scope: Generated UI mockup component SupplierImage.jsx from team-authored blueprint.md.
 *        Visual/layout implementation only. No requirements, architecture, or
 *        schema decisions were made by the AI tool.
 * Author review: <pending — team member to sign>
 */

import { useState } from 'react'
import { ImageOff } from 'lucide-react'

// Never let a broken image icon render. Until the team drops photos into
// public/images/, this placeholder is what shows.
// `supplier.image` is a path under /images/, e.g. "stalls/japanese.jpg".
export default function SupplierImage({
  supplier,
  className = '',
  ratio = 'aspect-[4/3]',
  rounded = '',
  compact = false,
}) {
  const [failed, setFailed] = useState(false)
  const shell = `relative w-full overflow-hidden bg-surface-alt ${ratio} ${rounded} ${className}`

  if (failed) {
    return (
      <div className={shell}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 text-center">
          <ImageOff size={compact ? 16 : 20} className="text-ink-40" aria-hidden="true" />
          {/* Thumbnails are too small for the label; the icon alone reads as deliberate. */}
          {!compact && (
            <>
              <span className="text-sm font-medium text-ink-40">{supplier.name}</span>
              <span className="text-xs text-ink-40">Image pending</span>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={shell}>
      <img
        /* Each path segment is encoded: some supplied filenames contain spaces. */
        src={'/images/' + supplier.image.split('/').map(encodeURIComponent).join('/')}
        alt={supplier.name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  )
}
