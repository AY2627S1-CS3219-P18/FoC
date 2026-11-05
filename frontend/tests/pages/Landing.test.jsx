/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5-5), date: 2026-11-05
 * Scope: Tests for the landing page's Bookmarked chip, per the 2026-11-05 supplier-bookmarking spec.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Landing from '../../src/pages/Landing'
import { listSuppliers } from '../../src/api/suppliers'

const pruneDeleted = vi.fn()
let bookmarks

vi.mock('../../src/api/suppliers', () => ({
  listSuppliers: vi.fn(),
  EMPTY_PAGE: {
    metadata: { totalRecords: 0, currPage: 1, limit: 50, totalPages: 0 },
    data: [],
    unavailable: [],
  },
}))
vi.mock('../../src/api/useApi', async () => {
  const { useEffect, useState } = await import('react')
  return {
    useReferenceData: () => ({ categories: [], locations: [] }),
    useApi: (load, deps) => {
      const [state, setState] = useState({ data: null, error: null, loading: true })
      useEffect(() => {
        let cancelled = false
        setState((s) => ({ ...s, loading: true }))
        load().then(
          (data) => !cancelled && setState({ data, error: null, loading: false }),
          (error) => !cancelled && setState({ data: null, error, loading: false }),
        )
        return () => {
          cancelled = true
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, deps)
      return state
    },
  }
})
vi.mock('../../src/context/BookmarksContext', () => ({ useBookmarks: () => bookmarks }))
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ isLoggedIn: true, sessionReady: true, requireAuth: vi.fn() }),
}))

const page = (data, unavailable) => ({
  metadata: { totalRecords: data.length, currPage: 1, limit: 50, totalPages: 1 },
  data,
  ...(unavailable ? { unavailable } : {}),
})
const card = (id, name) => ({
  id,
  name,
  type: 'Store',
  location_id: 1,
  location: 'Frontier',
  faculty_id: 1,
  faculty: 'Science',
  level: 1,
  categories: [],
  photos: [],
  isOpen: true,
})

const renderLanding = () =>
  render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  bookmarks = {
    ids: [3, 7],
    ready: true,
    isBookmarked: () => false,
    toggle: vi.fn(),
    pruneDeleted,
  }
  listSuppliers.mockResolvedValue(page([card(1, 'Everything Store')]))
})

describe('Landing Bookmarked chip', () => {
  it('sends the bookmarked ids when Bookmarked is chosen', async () => {
    listSuppliers.mockResolvedValueOnce(page([card(1, 'Everything Store')]))
    listSuppliers.mockResolvedValueOnce(page([card(3, 'Bookmarked Stall')], []))
    renderLanding()
    await screen.findByRole('link', { name: 'Everything Store' })

    fireEvent.click(screen.getByRole('button', { name: 'Bookmarked' }))

    await screen.findByRole('link', { name: 'Bookmarked Stall' })
    expect(listSuppliers).toHaveBeenLastCalledWith(expect.objectContaining({ ids: '3,7' }))
  })

  it('asks the bookmarks context to clear deleted entries, and ignores hidden ones on screen', async () => {
    const unavailable = [
      { id: 7, status: 'deleted' },
      { id: 9, status: 'hidden' },
    ]
    listSuppliers.mockResolvedValueOnce(page([card(1, 'Everything Store')]))
    listSuppliers.mockResolvedValueOnce(page([card(3, 'Bookmarked Stall')], unavailable))
    renderLanding()
    await screen.findByRole('link', { name: 'Everything Store' })

    fireEvent.click(screen.getByRole('button', { name: 'Bookmarked' }))

    await waitFor(() => expect(pruneDeleted).toHaveBeenCalledWith(unavailable))
  })

  it('shows an empty state and sends no ids when the user has no bookmarks', async () => {
    bookmarks = { ...bookmarks, ids: [] }
    renderLanding()
    await screen.findByRole('link', { name: 'Everything Store' })
    listSuppliers.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Bookmarked' }))

    await screen.findByText('No bookmarked suppliers.')
    expect(listSuppliers).not.toHaveBeenCalled()
  })
})
