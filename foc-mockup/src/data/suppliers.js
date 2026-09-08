/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-opus-5), date: 2026-09-08
 * Scope: Generated UI mockup component suppliers.js from team-authored blueprint.md.
 *        Visual/layout implementation only. No requirements, architecture, or
 *        schema decisions were made by the AI tool.
 * Author review: <pending — team member to sign>
 */

// TEAM DECISION (settled, not an AI choice): the supplier entity is the STALL, not the
// canteen. "The Deck" is a venue attribute on the stall. Standalone stalls with no venue are
// valid suppliers too. This table is flat — one row per orderable place. The venue grouping on
// the home page and /suppliers is a view over this list, not a parent-child relationship.
// Order Service is unaffected: supplierId still points at exactly one row.
//
// Placeholders chosen for the open questions the team has not yet answered — see AI-NOTES.md:
//   a. `venue` is a plain nullable string, not its own entity.
//   b. `hours` / `isOpen` live on the stall. A venue heading derives "n of m open" from its
//      stalls; there is no venue-level open state.
//   c. `supplierId` always points at a stall. Nothing can target a venue.
//
// `image` is a path under /images/ so the flat list needs no per-record directory field.
export const suppliers = [
  // --- The Deck: a venue with four stalls -----------------------------------------------
  {
    id: 's1',
    name: 'Roasted Delights',
    venue: 'The Deck',
    shortName: 'Roasted',
    location: 'Faculty of Arts & Social Sciences',
    category: 'Canteen',
    hours: { open: '07:30', close: '20:00' },
    isOpen: true,
    description: 'Roast meats, chicken rice, char siew.',
    activeRequests: 2,
    image: 'stalls/roasted delight.webp',
  },
  {
    id: 's2',
    name: 'Japanese',
    venue: 'The Deck',
    shortName: 'Japanese',
    location: 'Faculty of Arts & Social Sciences',
    category: 'Canteen',
    hours: { open: '11:00', close: '19:30' },
    isOpen: true,
    description: 'Donburi, katsu sets, cold soba.',
    activeRequests: 1,
    image: 'stalls/japanese.jpg',
  },
  {
    id: 's3',
    name: 'Yong Tau Foo & Laksa',
    venue: 'The Deck',
    shortName: 'YTF & Laksa',
    location: 'Faculty of Arts & Social Sciences',
    category: 'Canteen',
    hours: { open: '07:30', close: '19:00' },
    isOpen: true,
    description: 'Pick your own pieces, soup or dry, laksa gravy.',
    activeRequests: 1,
    image: 'stalls/yongtaufooandlaksa.jpg',
  },
  {
    id: 's4',
    name: 'Vegetarian',
    venue: 'The Deck',
    shortName: 'Vegetarian',
    location: 'Faculty of Arts & Social Sciences',
    category: 'Canteen',
    hours: { open: '10:30', close: '19:00' },
    // Deliberately closed while its neighbours are open: this is the case open question (b)
    // is about — a venue whose stalls disagree.
    isOpen: false,
    description: 'Mixed rice, all vegetarian, no onion or garlic on request.',
    activeRequests: 0,
    image: 'stalls/vegetarian.jpg',
  },

  // --- Venues carrying a single stall each ----------------------------------------------
  {
    id: 's5',
    name: 'Fine Food',
    venue: 'UTown',
    shortName: 'Fine Food',
    location: 'UTown',
    category: 'Food court',
    hours: { open: '07:30', close: '21:30' },
    isOpen: true,
    description: 'Food court in Stephen Riady Centre, one level up from the plaza.',
    activeRequests: 4,
    image: 'suppliers/utownfinefood.jpg',
  },
  {
    id: 's6',
    name: 'Flavours',
    venue: 'UTown',
    shortName: 'Flavours',
    location: 'UTown',
    category: 'Food court',
    hours: { open: '07:00', close: '21:00' },
    isOpen: true,
    description: 'The larger UTown food court, beside the Education Resource Centre.',
    activeRequests: 1,
    image: 'suppliers/flavours.jpg',
  },
  {
    id: 's7',
    name: '食堂',
    venue: 'UTown Plaza',
    shortName: '食堂',
    location: 'UTown',
    category: 'Food court',
    hours: { open: '10:30', close: '21:00' },
    isOpen: false,
    description: 'Chinese food court at the UTown plaza level.',
    activeRequests: 0,
    image: 'suppliers/utownplaza.png',
  },
  {
    id: 's8',
    name: 'Tomoro Coffee',
    venue: 'Hong Swee Sen Memorial Library',
    shortName: 'Tomoro',
    location: 'Hong Swee Sen Memorial Library',
    category: 'Café',
    hours: { open: '08:30', close: '20:00' },
    isOpen: true,
    description: 'Coffee, tea and pastries on the library level.',
    activeRequests: 1,
    image: 'stalls/tomorocoffee.jpg',
  },

  // --- No venue: canteens not yet broken into stalls ------------------------------------
  // These four are carried as single rows because their stall lists have not been collected
  // yet. They are not standalone by nature. See AI-NOTES.md.
  {
    id: 's9',
    name: 'Techno Edge',
    venue: null,
    shortName: 'Techno',
    location: 'Faculty of Engineering',
    category: 'Canteen',
    hours: { open: '07:00', close: '21:00' },
    isOpen: false,
    description: 'Engineering canteen next to E2. Known for the late-night supper stalls.',
    activeRequests: 0,
    image: 'suppliers/techno-edge.jpg',
  },
  {
    id: 's10',
    name: 'Frontier',
    venue: null,
    shortName: 'Frontier',
    location: 'Faculty of Science',
    category: 'Canteen',
    hours: { open: '07:30', close: '20:30' },
    isOpen: true,
    description: 'Science canteen at S16. Wide stall mix, gets very full at noon.',
    activeRequests: 2,
    image: 'suppliers/frontier.png',
  },
  {
    id: 's11',
    name: 'The Terrace',
    venue: null,
    shortName: 'Terrace',
    location: 'School of Design & Environment',
    category: 'Canteen',
    hours: { open: '07:30', close: '19:00' },
    isOpen: true,
    description: 'Open-air canteen at SDE. Quiet outside lunch hours.',
    activeRequests: 1,
    image: 'suppliers/terrace.png',
  },
  {
    id: 's12',
    name: 'PGPR Canteen',
    venue: null,
    shortName: 'PGPR',
    location: "Prince George's Park Residences",
    category: 'Canteen',
    hours: { open: '07:00', close: '22:00' },
    isOpen: true,
    description: 'Residence canteen serving PGPR. Breakfast and late supper.',
    activeRequests: 2,
    image: 'suppliers/PGP-canteen.jpg',
  },

  // --- Genuinely standalone stalls: no venue at all -------------------------------------
  // Added to make the flat model visible. Names are PLACEHOLDERS — verify before D1.
  {
    id: 's13',
    name: 'Cool Spot',
    venue: null,
    shortName: 'Cool Spot',
    location: 'University Sports Centre',
    category: 'Café',
    hours: { open: '08:00', close: '20:00' },
    isOpen: true,
    description: 'Drinks and snacks kiosk by the sports centre.',
    activeRequests: 1,
    image: 'stalls/cool-spot.jpg',
  },
  {
    id: 's14',
    name: 'Spinelli Coffee',
    venue: null,
    shortName: 'Spinelli',
    location: 'Faculty of Law',
    category: 'Café',
    hours: { open: '08:00', close: '18:00' },
    isOpen: false,
    description: 'Coffee bar on the law campus.',
    activeRequests: 0,
    image: 'stalls/spinelli.jpg',
  },
]

// Derived, not hardcoded: a category with no suppliers left stops appearing in filters.
export const categories = [...new Set(suppliers.map((s) => s.category))]

export const getSupplier = (id) => suppliers.find((s) => s.id === id)

// "Roasted Delights @ The Deck" — used everywhere a stall appears outside its venue group.
export const qualifiedName = (supplier) =>
  supplier ? (supplier.venue ? supplier.name + ' @ ' + supplier.venue : supplier.name) : ''

// Search matches the stall name, the venue name, the location and the category, so "Deck"
// returns every stall in it and "laksa" returns the stall directly.
export const matchesQuery = (supplier, query) => {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [supplier.name, supplier.venue, supplier.location, supplier.category]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(q)
}

// A view over the flat list: venues in first-seen order, then everything with no venue.
// Nothing here implies a parent-child relationship in the data.
export const groupByVenue = (list) => {
  const groups = []
  const byVenue = new Map()
  const standalone = []

  list.forEach((s) => {
    if (!s.venue) {
      standalone.push(s)
      return
    }
    if (!byVenue.has(s.venue)) {
      const group = { venue: s.venue, items: [] }
      byVenue.set(s.venue, group)
      groups.push(group)
    }
    byVenue.get(s.venue).items.push(s)
  })

  return { groups, standalone }
}

// Open state is per stall (placeholder for open question b); a venue only summarises.
export const venueOpenSummary = (items) => {
  const open = items.filter((s) => s.isOpen).length
  if (items.length === 1) return open === 1 ? 'Open now' : 'Closed'
  return open + ' of ' + items.length + ' open now'
}

// Other stalls sharing a venue — used on the stall detail screen.
export const stallsAtVenue = (supplier) =>
  supplier.venue ? suppliers.filter((s) => s.venue === supplier.venue && s.id !== supplier.id) : []
