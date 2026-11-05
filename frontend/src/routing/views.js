/*
 * AI Assistance Disclosure:
 * Tool: Claude Code (model: claude-sonnet-5), date: 2026-11-05
 * Scope: Created per instructions.md Stage 22 ("Page-to-view list: One shared list in code.
 *        Every route, the nav bar and the blocked-page check all read from it."). Routes
 *        (App.jsx) read MAIN_PAGE/mainPageFor and pass VIEWS.* into ViewGate; the nav bar
 *        (TopNav.jsx) reads NAV_LINKS; ViewGate (RouteGuards.jsx) reads VIEW_MODE_LABEL for the
 *        blocked-page message text.
 *        No requirements, architecture, schema, or API decisions were made by the AI tool.
 * Author review:
 */

export const VIEWS = { REQUESTER: 'requester', COURIER: 'courier' }

export const MAIN_PAGE = {
  [VIEWS.REQUESTER]: '/suppliers',
  [VIEWS.COURIER]: '/requests',
}

// "This is only available in <view> mode" (Stage 22's blocked-page wording).
export const VIEW_MODE_LABEL = {
  [VIEWS.REQUESTER]: 'requester mode',
  [VIEWS.COURIER]: 'courier mode',
}

export const NAV_LINKS = {
  [VIEWS.REQUESTER]: [
    { to: '/suppliers', label: 'Suppliers' },
    { to: '/my-errands', label: 'My errands' },
  ],
  [VIEWS.COURIER]: [
    { to: '/requests', label: 'Find errands' },
    { to: '/my-deliveries', label: 'My deliveries' },
  ],
}

export function mainPageFor(view) {
  return MAIN_PAGE[view] ?? MAIN_PAGE[VIEWS.REQUESTER]
}
