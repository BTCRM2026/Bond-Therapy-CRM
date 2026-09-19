# Bond Therapy CRM - Project Instructions

These rules are authoritative for all development in this repository. Apply them automatically to every new screen and every modification. Do not ask the user to repeat them.

## Product and architecture guardrails

- Preserve the already-defined CRM functionality, modules, workflows, data model, routes, and technical architecture.
- Do not change the approved stack unless the user explicitly requests it.
- Do not replace working functionality with visual assumptions or redesign working workflows unnecessarily.
- Do not introduce unrelated modules, widgets, dashboards, animations, or decorative content.
- Do not use Cloudflare R2, Sentry, GitHub integrations, Better Auth, SMTP/email services, or any other external service unless the user explicitly approves it first.
- Before proposing an external service, explain why it is needed, its cost implications, and the alternatives.

## Global UI/UX direction

The entire CRM must use one centralized design system. The desired visual language is:

- Clean, professional, minimal, spacious, modern enterprise SaaS/ERP.
- Soft and premium, information-dense without feeling crowded.
- Strong hierarchy, excellent whitespace, subtle borders, restrained corners, minimal visual noise.
- A serious daily-use business application, not a marketing website.

Prioritize usability, readability, consistency, scanning speed, information hierarchy, responsive behavior, and operational efficiency.

Avoid excessive gradients, shadows, bright/multicolor palettes, oversized cards, giant headings, decorative illustrations, unnecessary animation, excessive icons, glassmorphism, neon colors, heavy borders, and noisy dashboards. Every visible element must have a functional purpose.

## Color tokens

- Authenticated CRM background: soft mineral gray, `#F3F6F5`.
- Surface/card and sidebar: pure white, `#FFFFFF`.
- Primary text: deep charcoal-green, `#17231F`.
- Secondary text: muted mineral gray, `#64736E`.
- Tertiary/disabled text: `#93A19C`.
- Border: subtle mineral gray, `#DFE6E3`.
- Primary action color: restrained petrol green, `#0D5C52`; dark interaction state: `#08483F`; soft selected state: `#E7F2EF`.
- Warm amber may be used sparingly for warning and supporting accents. Avoid generic indigo/purple “AI dashboard” palettes in authenticated CRM screens.
- Status colors: muted green for success, muted amber/orange for warning, muted red for error, and muted blue/cyan for information.
- Use semantic colors only to communicate status, action, selection, or focus.
- The overall interface must remain predominantly white, mineral gray, deep charcoal, and restrained petrol green.
- These authenticated CRM tokens are intentionally scoped away from the login page. Do not change the approved login page styling unless explicitly requested.

## Typography

- Use Manrope consistently throughout authenticated CRM portals. Keep Inter on the approved login experience.
- Page title: 24-28px, weight 600.
- Section heading: 16-18px, weight 600.
- Card heading: 14-16px, weight 600.
- Body: 14px, weight 400.
- Secondary text: 12-13px, weight 400.
- Table text: 13-14px.
- Small label: 11-12px, weight 500.
- Button: 13-14px, weight 500-600.
- Avoid unnecessarily large typography.

## Spacing and shape

- Use a 4px base spacing system: 4, 8, 12, 16, 20, 24, and 32px.
- Main page padding: approximately 24px.
- Card padding: 16-20px.
- Major section gap: 24-32px.
- Form-field gap: 16px; label-to-input gap: 6-8px.
- Button gap: 8-12px; table-cell padding: 12-16px.
- Small controls: 6px radius.
- Inputs and buttons: 6-8px radius.
- Cards and large containers: 8-12px radius.
- Reserve pill shapes for statuses, tags, filters, and small categorical indicators.
- Prefer subtle borders over shadows. Use only minimal elevation when required.

## Application shell

### Sidebar

- Light/white, compact, clean, and visually quiet.
- Use one consistent line-icon family with 16-20px icons and consistent stroke width.
- Navigation rows: approximately 36-40px tall, 10-12px horizontal padding, 10px icon gap, 6-8px radius.
- Use a restrained brand active state; do not make every item visually heavy.
- Support grouping, sub-navigation, and collapsed state.

### Top header

- Minimal white/light surface with a subtle bottom border.
- Include search, notifications, profile, company context, and quick actions only where functionally required.
- Never create an oversized header.
- Every authenticated module in every portal must use the shared `DashboardShell` header pattern used by Staff & Access: compact module title and description on the left, contextual module actions followed by notifications on the right.
- Put primary module actions in the shared `page-header-actions` area. Do not create a second page-title or hero block inside module content.
- Treat this header as the permanent default for all future authenticated pages; vary only its title, description, and functionally required actions.

### Page header

- Use a consistent compact structure: title, short description, and primary action aligned appropriately.
- Do not create hero sections within CRM modules.

## Shared component rules

- Check for an existing shared component before creating a new one.
- Centralize tokens and shared components so global design changes can be made in one place.
- Reuse the same button, input, select, date picker, card, table, badge, tab, modal, drawer, dropdown, tooltip, pagination, search, filter, toast, empty-state, and loading-state systems everywhere.
- Never allow modules to invent their own typography, control heights, corners, colors, cards, or buttons.

### Cards and KPIs

- White surface, subtle border, 8-12px radius, 16-20px padding, minimal shadow.
- Do not wrap every small value in its own card.
- KPI cards should be compact: small label, clear value, optional trend, and brief context.
- Avoid oversized illustrations and decorative KPI treatments.

### Buttons

- Standard height: approximately 36-40px; radius 6-8px; font 13-14px, weight 500-600.
- Primary: brand background and white text.
- Secondary: white background, subtle border, dark text.
- Tertiary: transparent with dark/brand text.
- Danger: restrained red and used only for destructive actions.
- Icon button: 32-36px square, subtle hover, tooltip when meaning is not obvious.

### Inputs and selects

- White background, thin subtle border, 6-8px radius, 38-42px height, 13-14px text.
- Use clear placeholders and a subtle brand-colored focus border/ring without glow.
- Labels: 12-13px, medium weight. Helper/error text: 12px and restrained.
- Selects and menus must match the input system and remain compact.

### Tables

- Tables are a primary CRM interaction and must be designed carefully.
- Use white backgrounds, compact rows, minimal borders, strong alignment, subtle horizontal separators, hover states, and status badges.
- Header text: approximately 12px, medium/semibold muted gray.
- Body text: 13-14px. Row height: approximately 44-52px depending on content.
- Avoid excessive vertical borders.

### Badges and tabs

- Badges must be compact with soft semantic backgrounds and darker semantic text; never use saturated fills.
- Tabs should be compact text tabs with a restrained brand indicator. Avoid large button-like tabs unless functionally required.

### Modals and drawers

- Modals: focused white surface, 10-12px radius, subtle shadow, clear hierarchy, comfortable padding, and only the necessary size.
- Drawers: preserve page context, use a clear header and close action, and add a sticky action footer when useful.

### Forms

- Optimize for operational efficiency with clear sections and consistent labels.
- Use two columns where appropriate and one column for complex fields or smaller screens.
- Use sticky action footers when they materially improve long forms.
- Do not surround every field with another card.

### Search and filters

- Keep common search, status, date, department, and filter controls compact.
- Move large filter sets into a drawer rather than consuming excessive page height.

## States and interaction

- Hover: very light background/border change or restrained brand tint.
- Focus: clear accessible brand focus ring.
- Disabled: reduced contrast and no interaction.
- Normal transitions: approximately 150-200ms.
- Never use bouncing, dramatic scaling, glow, or unnecessary motion.
- Use dimensionally accurate skeletons for loading rather than routine full-screen spinners.
- Empty states should be simple: clear message, brief guidance, and one relevant action.
- Errors must be understandable and actionable; do not expose technical messages to normal users.
- Toasts must be compact, professional, and consistent.

## Responsive requirements

- Every page must be checked on desktop, laptop, tablet, and mobile.
- Do not merely shrink desktop layouts.
- Collapse the sidebar, stack KPI cards, convert multi-column forms to one column, move filters into drawers, and preserve accessible actions on small screens.
- Tables may scroll horizontally or use a purpose-built mobile layout.
- Nothing may overflow the viewport.

## Development priority

For every page or change, follow this order:

1. Preserve existing functionality.
2. Preserve existing data.
3. Preserve workflows.
4. Preserve routes.
5. Apply this global design system.
6. Reuse shared components.
7. Improve consistency.
8. Ensure responsive behavior.
9. Verify spacing and typography.
10. Check desktop and mobile states.

## Completion checklist

A page is not complete until it feels like the same Bond Therapy CRM product as every other module. Confirm that it has a soft neutral background, mostly white surfaces, compact Manrope typography in authenticated portals, subtle borders, restrained brand color, consistent buttons and inputs, efficient spacing, easy scanning, simple cards, responsive behavior, and no unnecessary decoration.
