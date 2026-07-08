# Design

## Theme

Lucky List uses a restrained monochrome product theme. The primary interface is light: white surfaces, near-black text, measured gray borders, and minimal shadows. Dark mode remains supported as a true black working mode, not a colored theme.

## Color Tokens

- Background: `#fafafa`
- Surface: `#ffffff`
- Surface strong: `#f4f4f5`
- Foreground: `#09090b`
- Muted text: `#52525b`
- Border: `#d4d4d8`
- Primary/accent: foreground black
- Success: muted green only for done/progress state
- Warning: muted amber only for due-soon state
- Danger: muted red only for overdue/destructive state

## Typography

Use `Geist` for Latin UI text and `Noto Sans Thai` for Thai fallback in the same sans stack:

`Geist`, `Noto Sans Thai`, `ui-sans-serif`, `system-ui`, `sans-serif`

Headings are compact and strong, but not decorative. Product UI uses fixed rem sizes, normal letter spacing, and dense but readable line-height.

## Components

- Buttons use one vocabulary: black primary, bordered/gray secondary, quiet ghost, muted semantic danger/success.
- Panels use thin borders and no decorative shadow.
- Active navigation uses black fill in light mode and white fill in dark mode.
- Badges use border + subtle tint, not saturated fills.
- Cards stay at 8px radius and avoid nested-card composition.

## Layout

The desktop app shell uses a collapsible sidebar rail and sticky header. Mobile uses a five-item bottom navigation with secondary destinations behind More. Pages should stay dense enough for repeated work while leaving clear group spacing between panels.

Kanban and task-heavy views use compact cards with one-line notes, thinner progress bars, and responsive `auto-fit` grids so large task sets show more cards per row before requiring vertical scrolling.

The board view works as a command center: summary metrics first, then filters and density controls, then kanban lanes with a desktop inspector for today, due-soon, and recent activity. Local development may load demo tasks for realistic density testing.

Board cards are scan-first: default cards show only title, priority, due state, category, progress, and subtask count. Notes, subtask controls, and destructive actions stay out of the card surface; users open the task modal for detail work, while quick actions remain hidden behind hover or the card actions button. Kanban lanes use internal scrolling on desktop so high-volume boards keep their headers and controls stable.

## Motion

Use short 150-200ms transitions for hover, focus, menus, and feedback. Do not add page-load choreography. Respect reduced motion.
