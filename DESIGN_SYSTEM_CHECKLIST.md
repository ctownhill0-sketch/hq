# Design System Checklist

Completion checklist for the HQ Desk UI (Stage 1.5a), using the items from
[designsystemchecklist.com](https://www.designsystemchecklist.com/).

**Source note:** designsystemchecklist.com itself was blocked by this build
environment's network policy, so the items below were read from the site's
open-source repository, [ardakaracizmeli/design-system-checklist](https://github.com/ardakaracizmeli/design-system-checklist)
(`src/data/*.js` + `src/translations/en/*.js`), and listed in the same order.
No items were added or invented. Statuses: **Done**, **Not applicable**, **Deferred**.

## Design principles (HQ Desk)

1. **Calm and fast.** Dense, quiet screens; one accent colour per view; no decoration that repeats daily.
2. **Keyboard first.** Every action reachable without a mouse; frequent actions (palette, quick log, tabs) are instant.
3. **Your data vs Google data.** Google details are shown live with attribution and never stored; everything else is yours.
4. **Never silent.** Every failure is visible next to where it happened, with a retry when possible; optimistic changes roll back on error.
5. **Nothing irreversible by accident.** Destructive actions confirm or give a 5-second Undo; nothing is sent to anyone automatically.

## Writing

Sentence case. Plain words, short sentences, no jargon or hype. Buttons say what
they do ("Log call", "Mark declined"). Empty states name the next action.
Errors say what went wrong and what to do next. Numbers and money use
tabular figures.

## Motion policy

Instant: command palette, keyboard navigation and highlights, tab switches,
sorting/filtering, the quick-log drawer, theme switches. Short (≤200ms,
ease-out, transform/opacity only): toasts (enter and exit on the same edge),
dialogs/popovers (fade + slight scale from the trigger), button press (scale
0.97), Kanban drag overlay and drop settle (180ms), meter value changes,
skeleton shimmer. Tooltips: 400ms delay on the first, then instant. One
rare-moment delight: the "Paid pilot logged 🎉" toast. Reduced motion: no
transforms; opacity-only or instant.

## Type scale

Page title `text-2xl` semibold · card title `text-base` semibold · body `text-sm`
· meta `text-xs` muted. Inter variable, self-hosted.

## Design language

### Brand

| Item | Status | Reason |
| --- | --- | --- |
| Vision | Deferred | Product purpose is stated in the README; no separate vision document for a one-person internal tool yet. |
| Design principles | Done | See 'Design principles' at the top of this file. |
| Tone of voice | Done | Plain, calm, specific; see 'Writing' at the top of this file. |
| Terminology | Done | Stage, outcome and channel labels live in web/src/lib/constants.ts and are reused everywhere. |
| Brand assets | Not applicable | Internal tool with no brand assets beyond the 'HQ' mark and Inter. |

### Guidelines

| Item | Status | Reason |
| --- | --- | --- |
| Accessibility | Done | WCAG 2.1 AA target: contrast test on tokens, axe scan and keyboard walkthrough in npm run test:e2e. |
| Writing guidelines | Done | See 'Writing' at the top of this file. |
| Microcopy guidelines | Done | Sentence case, errors next to the action, empty states name the next action. |
| Terminology | Done | Same source as brand terminology (constants.ts). |
| Internationalisation | Not applicable | Single English-speaking user; dates and times use the browser locale via Intl. |

## Foundations

### Color

| Item | Status | Reason |
| --- | --- | --- |
| Accessibility | Done | test/contrast.test.js checks every text/background token pair at 4.5:1 and the accent/focus ring at 3:1, light and dark. |
| Semantic colors | Done | success, warning, destructive, info and seven pipeline-stage colours in web/src/styles/tokens.css. |
| Dark mode | Done | Full dark token set; follows the system preference or a saved choice. |
| Guidelines | Done | One indigo accent (--primary) for primary actions, focus and selection; stage colours always paired with icon + label. |

### Layout

| Item | Status | Reason |
| --- | --- | --- |
| Units | Done | Tailwind 4px spacing unit; radius tokens derived from --radius. |
| Grid | Deferred | Pages use local CSS grids with a shared max width; no global column grid defined. |
| Breakpoints | Done | Tailwind sm/md/lg/xl; sidebar collapses to icons below 1024px (tablet). |
| Spacing | Done | Consistent card/section spacing (gap-5, px-5 panels); grouping by space before dividers. |

### Typography

| Item | Status | Reason |
| --- | --- | --- |
| Responsiveness | Done | coss components switch text sizes at the sm breakpoint; headings use text-balance. |
| Grid relation | Deferred | Type sizes follow Tailwind's scale; not formally aligned to a baseline grid. |
| Readability | Done | Inter variable with cv11/ss01; text-balance on headings, text-pretty on body, tabular-nums for numbers. |
| Performance | Done | Self-hosted variable woff2 (no remote fonts), split by unicode range, font-display swap. |
| Guidelines | Done | Page title 2xl semibold, card titles base, body sm, meta xs muted; documented in this file. |

### Elevation

| Item | Status | Reason |
| --- | --- | --- |
| Shadows | Done | coss shadow scale (xs/sm/md/lg) for cards, popovers and dialogs. |
| Background colors | Done | --card and --popover surfaces per theme; dark popovers are lighter than cards. |
| Z-index | Done | --z-sticky/--z-sidebar/--z-overlay/--z-toast tokens; portals sit inside an isolated root. |

### Motion

| Item | Status | Reason |
| --- | --- | --- |
| Easing | Done | --ease-out cubic-bezier(0.2,0,0,1); coss ease-in-out replaced with ease-out. |
| Duration | Done | --duration-fast 120ms / base 160ms / slow 200ms; nothing over 300ms. |
| Accessibility | Done | prefers-reduced-motion drops transforms, keeps opacity; Kanban drop animation set to 0. |

### Iconography

| Item | Status | Reason |
| --- | --- | --- |
| Accessibility | Done | Decorative icons are aria-hidden; icon-only buttons have aria-label and a tooltip. |
| Style | Done | One outline set (lucide), currentColor. |
| Naming | Not applicable | Icons come from lucide-react and keep its names. |
| Relation with grid | Not applicable | Third-party icon set drawn on its own 24px grid. |
| Keywords | Not applicable | No custom icon library to search. |
| Reserved icons | Done | Each pipeline stage and core action has one fixed icon (StageBadge.tsx, nav). |
| Guidelines | Deferred | Usage rules are implicit in the code; not written up yet. |

## Core components

### Accordion

| Item | Status | Reason |
| --- | --- | --- |
| Active state | Not applicable | Not used in HQ Desk. Native <details> disclosure is used for the call script. |
| Composition | Not applicable | Not used in HQ Desk. Native <details> disclosure is used for the call script. |
| Toggle transition | Not applicable | Not used in HQ Desk. Native <details> disclosure is used for the call script. |
| Content and trigger relation | Not applicable | Not used in HQ Desk. Native <details> disclosure is used for the call script. |

### Alert

| Item | Status | Reason |
| --- | --- | --- |
| Colors | Done | error/warning/info/success variants. |
| Title support | Done | AlertTitle. |
| Icon support | Done | Icon per role. |
| Supplementary actions | Done | Retry and 'Search again to relink' actions. |
| Responsiveness | Done | Full width in its container. |
| Accessibility roles | Done | Errors render with role=alert. |

### Avatar

| Item | Status | Reason |
| --- | --- | --- |
| Image | Not applicable | Not used in HQ Desk. |
| Image fallback | Not applicable | Not used in HQ Desk. |
| Sizes | Not applicable | Not used in HQ Desk. |
| Colors | Not applicable | Not used in HQ Desk. |
| Shape | Not applicable | Not used in HQ Desk. |
| Avatar groups | Not applicable | Not used in HQ Desk. |
| Accessibility label | Not applicable | Not used in HQ Desk. |

### Badge

| Item | Status | Reason |
| --- | --- | --- |
| Colors | Done | Semantic and stage colours. |
| Variants | Done | outline/secondary/semantic variants. |
| Sizes | Done | sm/default/lg. |
| Icon support | Done | Stage badges carry an icon. |
| Dismissible action | Not applicable | No removable chips in this app. |
| Empty state | Not applicable | No dot-only badges. |
| Positioning | Not applicable | No notification badges. |

### Button

| Item | Status | Reason |
| --- | --- | --- |
| Colors | Done | default (accent), destructive, outline, secondary, ghost, link. |
| Variants | Done | One primary action per view. |
| Sizes | Done | xs–xl plus icon sizes; 44px targets on coarse pointers. |
| Icon support | Done | Leading icons and icon-only buttons. |
| Hover state | Done | Hover background change. |
| Active state | Done | Press scale 0.97 + inset shadow. |
| Loading state | Done | loading prop shows a spinner and disables. |
| Disabled state | Done | Disabled styling and pointer-events none. |
| Accessibility role | Done | Buttons are <button>; links render as <a> via render prop. |
| Focus indicator | Done | Focus ring on keyboard focus. |

### Breadcrumbs

| Item | Status | Reason |
| --- | --- | --- |
| Icon support | Not applicable | Not used in HQ Desk. |
| Disabled state | Not applicable | Not used in HQ Desk. |
| Collapsed state | Not applicable | Not used in HQ Desk. |
| Custom separator | Not applicable | Not used in HQ Desk. |

### Calendar

| Item | Status | Reason |
| --- | --- | --- |
| Display modes | Deferred | Month view only (own component); week/agenda views not needed yet. |
| Selected state | Done | Single selected day; ranges not needed. |
| Month selection | Done | Previous/next/Today buttons and PageUp/PageDown. |
| Day names | Done | Short weekday headers. |
| Internationalisation | Deferred | Month names localised via Intl; weekday labels and Monday week start are fixed. |
| Keyboard navigation | Done | Arrow keys, Home/End, PageUp/PageDown, roving focus. |
| State announcement | Done | aria-selected and full date labels including item counts and 'today'. |

### Card

| Item | Status | Reason |
| --- | --- | --- |
| Content composition | Done | Header/panel/footer slots. |
| Media sections | Not applicable | No media. |
| Supplementary actions | Done | CardAction slot in headers. |
| Responsiveness | Done | Cards stack full width on narrow screens. |
| Card groups | Done | Stat tiles and dashboard columns. |

### Carousel

| Item | Status | Reason |
| --- | --- | --- |
| Navigation controls | Not applicable | Not used in HQ Desk. |
| Item composition | Not applicable | Not used in HQ Desk. |
| Item sizes | Not applicable | Not used in HQ Desk. |
| Touch navigation | Not applicable | Not used in HQ Desk. |
| Responsiveness | Not applicable | Not used in HQ Desk. |
| Keyboard navigation | Not applicable | Not used in HQ Desk. |

### Checkbox

| Item | Status | Reason |
| --- | --- | --- |
| Label | Done | Label wraps the checkbox or aria-label names it. |
| Checked state | Done | Base UI checked state. |
| Error state | Not applicable | Checkboxes are never validated here. |
| Disabled state | Done | Supported by the component. |
| Indeterminate state | Not applicable | No nested selections. |
| Checkbox group | Not applicable | No checkbox groups. |
| Keyboard support | Done | Space toggles. |

### Divider

| Item | Status | Reason |
| --- | --- | --- |
| Direction | Done | Separator supports both; mostly spacing and dividers between list rows. |
| Accessibility role | Done | Base UI Separator role. |

### Dropdown

| Item | Status | Reason |
| --- | --- | --- |
| Content composition | Done | Menu, submenu (Move to…) and context menu. |
| Hover trigger | Not applicable | Menus open on click/keyboard by design. |
| Dynamic positioning | Done | Base UI collision-aware positioning. |
| Responsiveness | Done | Constrained to available space. |
| Focus trapping | Done | Focus moves into the menu and returns. |
| Keyboard navigation | Done | Arrow keys, Enter, Esc. |

### Icon

| Item | Status | Reason |
| --- | --- | --- |
| Colors | Done | currentColor. |
| Sizes | Done | 3–5 sizes via size-* utilities. |
| Interactivity | Done | aria-hidden unless meaningful. |

### Image

| Item | Status | Reason |
| --- | --- | --- |
| Sizes | Not applicable | Not used in HQ Desk. |
| Image fallback | Not applicable | Not used in HQ Desk. |
| Screen density support | Not applicable | Not used in HQ Desk. |
| Alt text | Not applicable | Not used in HQ Desk. |

### Link

| Item | Status | Reason |
| --- | --- | --- |
| Icon support | Done | External links show an icon and 'opens in a new tab' text for screen readers. |
| Colors | Done | Accent text colour token. |
| Disabled state | Done | Coming-next nav items use aria-disabled and muted styling. |
| Font inheritance | Done | Links inherit text styles. |
| Multiline display | Done | Inline links wrap. |
| Accessibility role | Done | Real <a href> elements; only http(s) URLs are rendered as links. |

### List

| Item | Status | Reason |
| --- | --- | --- |
| Order | Done | Ordered lists for questions and call logs, unordered elsewhere. |
| Content cmposition | Done | Rows with checkbox, text, meta and actions. |
| Accessibility role | Done | Semantic ul/ol. |

### Loading indicator

| Item | Status | Reason |
| --- | --- | --- |
| Colors | Done | Spinner uses currentColor. |
| Sizes | Done | Inherits icon sizing. |
| Loading duration | Done | Skeletons for unknown waits; button spinners for actions. |
| Reduced motion | Done | Animations shortened under reduced motion. |
| Accessibility label | Done | aria-busy + aria-label on skeleton regions. |

### Modal

| Item | Status | Reason |
| --- | --- | --- |
| Content composition | Done | Header/panel/footer. |
| Supplementary actions | Done | Footer actions, primary last. |
| Close action | Done | Close button, Esc and backdrop click. |
| Positioning | Done | Centred dialogs and a right-side sheet for quick log. |
| Sizes | Done | Width set per dialog. |
| Focus trapping | Done | Focus trapped; initial focus set to the first field. |
| Keyboard navigation | Done | Esc closes; Cmd/Ctrl+Enter saves the quick log. |
| Title and subtitle labeling | Done | Dialog title/description wired by Base UI. |

### Pagination

| Item | Status | Reason |
| --- | --- | --- |
| Selected page state | Not applicable | Not used in HQ Desk. |
| Page display ranges | Not applicable | Not used in HQ Desk. |
| Amount of items per page | Not applicable | Not used in HQ Desk. |
| Indeterminate amount of pages | Not applicable | Not used in HQ Desk. |
| Full page label announcements | Not applicable | Not used in HQ Desk. |
| State announcement | Not applicable | Not used in HQ Desk. |

### Progress bar

| Item | Status | Reason |
| --- | --- | --- |
| Label | Done | Meter label and value text. |
| Sizes | Done | Track height set per use. |
| Duration | Deferred | Indeterminate progress arrives with Deep Research in Stage 1.5b. |
| Accessibility label | Done | Base UI meter role with label. |

### Input radio

| Item | Status | Reason |
| --- | --- | --- |
| Label | Done | Theme segmented control items have accessible names. |
| Checked state | Done | data-checked styling. |
| Error state | Not applicable | Not used in validated forms. |
| Radio group | Done | Radio group semantics. |
| Keyboard support | Done | Arrow keys move between options. |

### Select

| Item | Status | Reason |
| --- | --- | --- |
| Label | Done | FieldLabel or aria-label on every select. |
| Error state | Not applicable | Selects always hold a valid value. |
| Disabled state | Done | Supported. |
| Placeholder | Done | 'All stages' style defaults instead of empty placeholders. |
| Helper text | Done | FieldDescription where useful. |
| Icon support | Done | Stage items show their icon. |
| Prefix | Not applicable | Not needed. |
| Accessibility label | Done | aria-label when no visible label. |

### Skeleton

| Item | Status | Reason |
| --- | --- | --- |
| Sizes | Done | Fixed heights matching real content (no layout shift). |
| Shapes | Done | Lines, blocks and rounded cards. |
| Composition | Done | Page-level skeleton layouts. |
| Reduced motion | Done | Shimmer stops under reduced motion. |

### Switch

| Item | Status | Reason |
| --- | --- | --- |
| Label | Not applicable | Not used in HQ Desk. |
| Checked state | Not applicable | Not used in HQ Desk. |
| Disabled state | Not applicable | Not used in HQ Desk. |
| Keyboard navigation | Not applicable | Not used in HQ Desk. |
| Accessibility label | Not applicable | Not used in HQ Desk. |

### Tabs

| Item | Status | Reason |
| --- | --- | --- |
| Content composition | Done | Each tab panel holds cards/forms. |
| Variants | Done | default and underline variants. |
| Selected state | Done | Underline indicator, instant switch. |
| Disabled state | Not applicable | No disabled tabs. |
| Icon support | Done | Research tab has an icon. |
| Equal width layout | Done | Supported; left-aligned tabs used on the agency page. |
| Keyboard support | Done | Arrow keys move between tabs. |

### Text area

| Item | Status | Reason |
| --- | --- | --- |
| Label | Done | Visible labels. |
| Error state | Done | aria-invalid + message on failed autosave. |
| Disabled state | Done | Supported. |
| Placeholder | Done | Example text. |
| Helper text | Done | FieldDescription. |
| Sizes | Done | rows per use. |
| Accessibility label | Done | aria-label when no visible label. |

### Text field

| Item | Status | Reason |
| --- | --- | --- |
| Label | Done | Visible labels. |
| Error state | Done | FieldError next to the field. |
| Disabled state | Done | Supported. |
| Placeholder | Done | Example values. |
| Helper text | Done | FieldDescription. |
| Icon support | Done | Search icon in the agencies search. |
| Prefix / Suffix | Not applicable | Not needed yet. |
| Sizes | Done | sm/default/lg. |
| Accessibility label | Done | aria-label when no visible label. |

### Toast

| Item | Status | Reason |
| --- | --- | --- |
| Content composition | Done | Title, description, action. |
| Colors | Done | success/info/warning/error. |
| Icon support | Done | Type icon. |
| Timeout | Done | 3s, 6s with an action, 8s for errors; pauses while hovered. |
| Stacking | Done | Stacked with expand on hover. |
| Supplementary action | Done | Undo for deletes, task completion and stage changes. |
| Focus management | Done | Base UI toast region is keyboard reachable; actions are buttons. |
| Reduced motion | Done | Slides from the same edge it exits; reduced motion keeps opacity only. |

### Tooltip

| Item | Status | Reason |
| --- | --- | --- |
| Positioning | Done | Collision-aware. |
| Timeout | Done | 400ms first, then instant for neighbours. |
| Keyboard support | Done | Opens on keyboard focus. |

## Maintenance

### Documentation

| Item | Status | Reason |
| --- | --- | --- |
| Design system principles | Done | This file. |
| Getting started | Done | README setup/run/dev sections. |
| Design best practices | Done | Principles, writing and motion policy in this file. |
| Development best practices | Done | README: dependencies, dev/build commands, tests. |
| Component anatomy | Deferred | Component anatomy is documented upstream by coss ui; no local write-up. |
| Component properties | Not applicable | coss ui and ReUI document their props upstream; app components are small and typed. |
| Component composition examples | Not applicable | Same as above. |
| Sandbox product example | Deferred | No Storybook/sandbox (avoided extra dependencies); the fake-data e2e run serves as a visual check. |
| Browser / OS support | Done | README: current Chrome, Edge, Firefox and Safari on a laptop/tablet. |
| Release cycle | Not applicable | Single-user app delivered in stages. |

### Local libraries

| Item | Status | Reason |
| --- | --- | --- |
| When to build | Not applicable | No product teams. |
| Horizontal and vertical libraries | Not applicable | No product teams. |
| Library expectations | Not applicable | No product teams. |
| Release cycle alignment | Not applicable | No product teams. |

### Team processes

| Item | Status | Reason |
| --- | --- | --- |
| Decision-making log | Done | Deviations and choices are recorded in the README and in stage summaries. |
| Roadmap | Done | Stages 1–5 in the brief; placeholders in the nav. |
| Stakeholder mapping | Not applicable | One user. |
| Analytics | Not applicable | No analytics or telemetry, by design. |
| Ongoing support "shifts" | Not applicable | One maintainer. |
| SLA | Not applicable | One maintainer. |

### Community support

| Item | Status | Reason |
| --- | --- | --- |
| Support channels | Not applicable | No community. |
| Templates | Not applicable | No community. |
| Regular updates | Not applicable | No community. |
| Open hours | Not applicable | No community. |

### Contribution

| Item | Status | Reason |
| --- | --- | --- |
| House rules for the system | Not applicable | Private, single-author project. |
| Contribution guidelines | Not applicable | Private, single-author project. |
| Feature proposal template | Not applicable | Private, single-author project. |
| Engagement | Not applicable | Private, single-author project. |

---

Totals: 148 Done · 73 Not applicable (mostly components HQ Desk does not use, and team-process items for a one-person tool) · 9 Deferred.
