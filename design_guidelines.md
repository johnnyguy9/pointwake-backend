# PointWake AI CallOps Platform - Design Guidelines

## Design Approach

**Selected Approach:** Design System (Enterprise Dashboard)
**Primary Reference:** Carbon Design System + Twilio Console patterns
**Justification:** Enterprise telephony platform requiring data-dense displays, real-time monitoring, and mission-critical functionality where clarity and efficiency trump visual flair.

## Core Design Principles

1. **Density-First:** Maximize information visibility without clutter
2. **Status-Driven:** Real-time states (available/busy/offline, active calls, incidents) must be immediately visible
3. **Action-Oriented:** Primary actions (answer call, dispatch vendor, escalate) prominently accessible
4. **Hierarchical Navigation:** Clear separation between monitoring, management, and configuration views

---

## Typography

**Font Families:** 
- Primary: Inter (Google Fonts) - UI text, tables, forms
- Monospace: JetBrains Mono - call IDs, timestamps, phone numbers

**Hierarchy:**
- Page Titles: text-2xl font-semibold
- Section Headers: text-lg font-medium
- Body/Tables: text-sm font-normal
- Labels/Metadata: text-xs font-medium uppercase tracking-wide
- Monospace Data: text-sm font-mono

---

## Layout System

**Spacing Primitives:** Tailwind units of **2, 4, 6, 8, 12, 16**
- Component padding: p-4, p-6
- Section spacing: space-y-6, space-y-8
- Card gaps: gap-4, gap-6
- Form fields: space-y-4

**Grid Structure:**
- Sidebar navigation: 16rem (w-64) fixed
- Main content: max-w-7xl with responsive padding
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Tables: Full width with horizontal scroll on mobile

---

## Component Library

### Navigation
- **Sidebar (Fixed Left):** Logo, main navigation (Dashboard, Calls, Incidents, Properties, Vendors, Reports), user profile at bottom
- **Top Bar:** Breadcrumbs, global search, user availability toggle (Available/Busy/Offline), notifications bell

### Dashboard Cards
- **Active Calls Card:** Real-time list with caller ID, duration timer, AI/Human indicator, action buttons (Join, Transfer)
- **Open Incidents Card:** Count badge, recent items with property/unit, severity indicator, quick actions
- **Availability Status:** Team roster grid showing online/offline/busy states with avatars
- **Usage Metrics:** Today's stats - total calls, AI-handled %, avg handle time, dispatch count

### Incoming Call UI (Modal/Overlay)
- **Full-screen takeover** when call rings
- Large caller information display (phone number, property/unit if identified)
- Prominent Accept (green) / Decline (red) buttons with blur backdrop
- Auto-display AI-gathered context if call was AI-answered first

### Incident/Ticket Management
- **Table View:** Filterable/sortable columns - ID, Property, Unit, Trade, Severity, Status, Created, Assigned To
- **Detail Panel (Slide-over):** Full incident timeline, call transcript, dispatch actions, vendor responses, notes section
- **Status Badges:** Styled pills for Open/Dispatched/Resolved/Escalated with appropriate visual weight

### Property/Vendor Directory
- **Search & Filter Bar:** Trade filter, coverage area, after-hours availability toggles
- **Card Grid Layout:** Each property/vendor as compact card with key details, edit/view actions
- **Quick Actions:** Assign to incident, view history, edit details

### Real-Time Elements
- **Live Indicators:** Pulsing dot for active calls, badge counts that update via WebSocket
- **Toast Notifications:** Bottom-right position for new incidents, vendor confirmations, escalations
- **Connection Status Bar:** Subtle top banner if WebSocket disconnects

### Forms
- **Inline Editing:** Click-to-edit for incident notes, vendor contact updates
- **Multi-Step Wizards:** Property setup, escalation policy creation with progress indicator
- **Validation:** Inline error messages, field-level feedback

### Tables
- **Sticky Headers:** For long incident/call logs
- **Row Actions:** Kebab menu (⋮) on hover for edit/delete/view
- **Pagination:** Standard controls with item count display
- **Empty States:** Helpful illustrations with action prompts

---

## Key Page Layouts

### Dashboard (Landing)
- Top: Quick stats bar (4 metric cards)
- Middle: 2-column grid - Active Calls (left) + Open Incidents (right)
- Bottom: Team Availability roster + Recent Activity feed

### Call Log
- Filter sidebar (date range, outcome, AI vs human)
- Main: Sortable table with playback icons for recorded calls
- Detail view: Slide-over with full transcript + metadata

### Incident Detail
- Header: Breadcrumb, incident ID, status, timestamps
- 2-column: Left (incident details, property/unit info) + Right (activity timeline)
- Bottom: Action bar for dispatch, escalate, resolve

### Reports/Billing
- Date range selector + export button (top)
- Usage charts (line graph for call volume, pie for AI vs human)
- Billing breakdown table by location
- Summary cards for monthly totals

---

## Visual Treatment Notes

- **No large hero images** - This is a functional dashboard, not marketing
- **Iconography:** Heroicons (outline style) for navigation and actions
- **Data Visualization:** Simple bar/line charts (Chart.js or Recharts) for usage trends
- **Loading States:** Skeleton screens for tables, spinners for actions
- **Responsive:** Mobile-first tables collapse to card views, sidebar becomes drawer

---

## Critical UX Patterns

- **Incoming Call Priority:** Full-screen modal interrupts all other activity
- **Contextual Actions:** Actions always near relevant data (e.g., "Dispatch" button on incident card)
- **Bulk Operations:** Checkboxes in tables for multi-select actions
- **Search Everywhere:** Global search includes properties, vendors, incidents, call logs
- **Keyboard Shortcuts:** Answer call (Space), dismiss (Esc), open search (/)