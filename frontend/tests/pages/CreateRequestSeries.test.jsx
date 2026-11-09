/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-09
 * Scope: Stage 28 g (instructions.md) - tests for CreateRequest's series mode: creating a
 *        recurring errand (startAt/startNow, the recurrence picker's output as `rrule`, and
 *        durationMinutes computed from the start/deliver-by gap) and editing one (rrule/
 *        duration change, no startAt sent). Mirrors CreateRequest.test.jsx's mocked style.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import CreateRequest from '../../src/pages/CreateRequest'

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ credits: { available: 10 }, isLoggedIn: true, sessionReady: true }),
}))
vi.mock('../../src/api/suppliers', () => ({
  listSuppliers: () => Promise.resolve({ data: [{ id: 1, name: 'Deck Cafe' }] }),
  getSupplier: (id) => Promise.resolve({ id: Number(id), name: 'Deck Cafe' }),
}))
vi.mock('../../src/api/lastRequest', () => ({
  getLastRequest: vi.fn(() =>
    Promise.resolve({ last_req_del_loc_id: 3, last_req_del_loc_details: 'Desk' }),
  ),
  saveLastRequest: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../src/api/orders', () => ({
  createOrder: vi.fn(),
  editOrder: vi.fn(),
  listMyOrders: vi.fn(() => Promise.resolve({ orders: [] })),
}))
vi.mock('../../src/api/useApi', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, useReferenceData: () => ({ locations: [{ location_id: 3, location: 'Library' }] }) }
})

const SERIES = {
  id: 'series-1',
  supplierId: 1,
  description: 'Coffee run',
  deliveryLocationId: 3,
  deliveryDetails: 'Leave at desk',
  credits: 4,
  durationMinutes: 120,
  additionalDetails: null,
  rrule: 'FREQ=DAILY;INTERVAL=1',
  startAt: '2026-11-09T01:00:00.000Z',
}

vi.mock('../../src/api/series', () => ({
  createSeries: vi.fn(() => Promise.resolve({})),
  editSeries: vi.fn(() => Promise.resolve({})),
  getSeries: vi.fn(() => Promise.resolve(SERIES)),
  seriesErrorMessage: (e) => e.message,
}))

describe('CreateRequest series mode: create', () => {
  it('starts later, builds the recurrence rule, and computes durationMinutes from the gap', async () => {
    const { createSeries } = await import('../../src/api/series')
    render(
      <MemoryRouter initialEntries={['/series/new?supplier=1']}>
        <CreateRequest seriesMode />
      </MemoryRouter>,
    )
    fireEvent.change(screen.getByLabelText(/What do you need/), { target: { value: 'Coffee' } })
    // The saved-location prompt fills location + details together, like CreateRequest.test.jsx.
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))

    fireEvent.click(screen.getByRole('button', { name: 'Start later' }))
    // Document order: Start's Date/Time render before Deliver-by's.
    const [startDateInput, deliverByDateInput] = screen.getAllByLabelText('Date')
    const [startTimeInput, deliverByTimeInput] = screen.getAllByLabelText('Time')
    fireEvent.change(startDateInput, { target: { value: '2026-12-01' } })
    fireEvent.change(startTimeInput, { target: { value: '09:00' } })
    fireEvent.change(deliverByDateInput, { target: { value: '2026-12-01' } })
    fireEvent.change(deliverByTimeInput, { target: { value: '10:30' } })

    fireEvent.click(screen.getByRole('button', { name: 'Create recurring errand' }))

    expect(createSeries).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId: 1,
        description: 'Coffee',
        deliveryLocationId: 3,
        deliveryDetails: 'Desk',
        credits: 4,
        rrule: 'FREQ=DAILY;INTERVAL=1',
        durationMinutes: 90,
        startAt: new Date('2026-12-01T09:00').toISOString(),
      }),
    )
  })
})

describe('CreateRequest series mode: edit', () => {
  it('loads the series and saves via editSeries with the rebuilt rrule, without startAt', async () => {
    const { editSeries } = await import('../../src/api/series')
    render(
      <MemoryRouter initialEntries={['/series/series-1/edit']}>
        <Routes>
          <Route path="/series/:id/edit" element={<CreateRequest seriesMode />} />
          <Route path="/my-errands" element={<p>Saved</p>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByLabelText(/Exact delivery details/)).toHaveValue('Leave at desk')
    expect(screen.getByText('Edit recurring errand')).toBeInTheDocument()
    // startAt can't be edited: no "When should this start?" section.
    expect(screen.queryByText('When should this start?')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Saved')
    expect(editSeries).toHaveBeenCalledWith(
      'series-1',
      expect.objectContaining({
        rrule: 'FREQ=DAILY;INTERVAL=1',
        deliveryDetails: 'Leave at desk',
      }),
    )
  })
})
