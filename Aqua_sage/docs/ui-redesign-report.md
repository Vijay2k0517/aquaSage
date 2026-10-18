# AquaSage — Premium Digital Twin UI Redesign Report

**Date:** October 18, 2026  
**Status:** Completed & Production Verified  
**Target Environment:** Next.js 15 App Router, React Three Fiber, Three.js, Tailwind CSS  
**Route:** `http://localhost:3000/simulator`

---

## 1. Executive Summary

The AquaSage 3D IoT Digital Twin interface has been redesigned from a prototype layout into a high-end, production-grade industrial command center (SCADA / digital-twin engineering standard, following modern industrial software aesthetics such as Siemens, AVEVA, and Emerson).

The previous interface suffered from:
1. Floating label collision around the pump, manifold, and analytical bypass bay.
2. Cluttered top ribbon floating over the 3D models with redundant scenario controls.
3. Over-reliance on glowing neon cyan lines, bright ground grids, and decorative effects.
4. Lack of clean structural hierarchy between equipment navigation, scenario selection, and contextual telemetry inspection.

The redesigned interface achieves:
- **Zero Sensor Label Collisions:** Unselected sensors render as sleek, unobtrusive industrial pucks (28px) with status rings and short codes (`US-01`, `FS-01`, `P1`, `P2`, `TDS`, `TURB`), expanding smoothly into full HUD telemetry tags only on hover or selection.
- **Compact Industrial Header (56px):** Identity, simulation running state with green pulse, 1:1 metric skid dimensions, camera view presets (`Overview`, `Front`, `Tank`, `Pump`, `ESP32`), Component Navigator search, and Reset View button.
- **Collapsible System Explorer Sidebar (260–280px):** Dedicated, clean sections for **Scenarios** (all 7 deterministic scenarios) and **Equipment** (categorized tree with live telemetry readings and hardware-readiness status dots).
- **Subdued 3D Viewport:** Deep ink navy backdrop (`#070B14`) and restrained slate floor grid (`#334155` / `#161F30`), ensuring the physical skid, acrylic water tank, stainless pipes, pump, and valves are the primary visual focus.
- **Contextual Component Inspector Drawer (340px):** Slides in smoothly from the right only when a component is selected, displaying prominent tabular telemetry, validity status, alarm severity, operating envelope, technical specifications, scientific advisories, and skid coordinates.
- **Bottom Simulation Control Dock:** Replaces the top ribbon with a compact, grounded bottom dock providing primary playback controls (`Pause`/`Resume`, `+1s`, `Reset`), live KPIs (Time $T$, Reservoir Level/Volume, Net Flow), and a unified System Alarm status pill.

---

## 2. Visual Language & Aesthetics

| Design Element | Specification | Rationale |
| :--- | :--- | :--- |
| **Canvas Background** | Deep ink navy (`#070B14`) | High visual contrast with 3D metallic and acrylic elements; minimizes eye fatigue |
| **Panel Surfaces** | Restrained navy (`#0F172A` / 95% opacity with blur) | Clean visual separation from the 3D canvas without obscuring spatial depth |
| **Borders & Dividers** | Restrained blue-gray slate (`#1E293B`, `#334155`) | Subtle structural definition without high-contrast distraction |
| **Primary Accent** | Precision Cyan (`#06B6D4` / `#22D3EE`) | Reserved exclusively for active selection, interactive focus, and confirmed values |
| **Status Signals** | Emerald (`#10B981`), Amber (`#F59E0B`), Rose (`#EF4444`) | Standard industrial SCADA status conventions (Normal, Warning, Critical) |
| **Ground Grid** | Subdued slate (`#334155`, `#161F30`) | Removed glaring cyan center line; provides spatial reference without competing with skid geometry |
| **Typography** | Modern sans-serif for UI labels, Tabular monospace for numbers | Prevents layout jitter when numerical sensor values change |

---

## 3. Priority Resolution: Sensor Label Collision Fix

### Problem
In the previous implementation, wide billboard labels for `FS-01`, `PT-01`, `PT-02`, `TDS-01`, and `TURB-01` were rendered simultaneously at fixed 3D offsets within a tight physical cluster ($X \in [0.25, 0.81\text{m}]$ and $Y \in [0.48, 0.68\text{m}]$), causing overlapping text and unreadable tags.

### Architectural Solution (`src/components/simulator/SensorPlaceholder.tsx`)
1. **Compact Industrial Puck State:**
   - In rest state (unselected, unhovered), sensors render as circular 28px pucks with short identifiers (`US-01`, `FS-01`, `P1`, `P2`, `TDS`, `TURB`).
   - Each puck displays a status dot (emerald for normal, amber for warning, rose for critical).
   - In warning or critical states, a subtle pulsing ring alerts the operator without expanding the label.
2. **Contextual Expansion on Hover or Selection:**
   - Hovering over a puck or selecting it in the 3D viewport or equipment sidebar smoothly expands it into the full HUD tag displaying component name, live telemetry reading, unit, status badge, and `SIM` pill.
   - Selected/hovered tags are elevated in 3D z-index (`zIndexRange: [300, 200]`), guaranteeing they render above background pucks.
3. **Multi-Angle Consistency:**
   - Verified across Isometric Overview, Front Elevation, and Pump & Manifold camera presets. Zero collisions occur at any viewing angle.

---

## 4. Redesigned Layout Architecture

### A. Compact Top Header (`h-14` / 56px)
- **Left Identity:** AquaSage logo icon, title `AQUASAGE / Digital Twin`, and subtitle `Precision Water Infrastructure IoT Telemetry Simulator`.
- **Center Status:**
  - `SIMULATION RUNNING` (emerald pulse) or `SIMULATION PAUSED` (amber) with `Deterministic Engine` pill.
  - `1:1 Metric Skid (1.8m × 0.8m × 1.6m)` dimensional scale pill.
- **Right Controls:**
  - Quick Camera View Presets (`Overview`, `Front`, `Tank`, `Pump`, `ESP32`).
  - Component Search / Navigator (`ComponentNavigator.tsx`).
  - Reset View button (`RotateCcw`, `Reset View`).

### B. Collapsible System Explorer Sidebar (`SimulatorSidebar.tsx`)
- **Dimensions:** 264px wide on desktop, collapsible to 0px with smooth transition and floating `Sidebar` expand tab.
- **Scenarios Section:**
  - All 7 deterministic scenarios accessible in a single vertical list:
    1. *Normal Operation*
    2. *Low Tank Level*
    3. *Leak Simulation*
    4. *Restricted Flow*
    5. *Elevated TDS*
    6. *Elevated Turbidity*
    7. *Sensor Fault / Disconnection*
  - Active scenario highlighted with cyan border and subtle glow. Fault scenarios marked with compact amber `Fault` badges.
- **Equipment Section:**
  - Ordered asset hierarchy strictly aligned with specification:
    1. *Water Tank* (`tank`)
    2. *Pump and Motor* (`pump`, `motor`)
    3. *Main and Bypass Pipes* (`pipe-main`, `pipe-bypass`)
    4. *Valves* (`valve-v1`, `valve-v2`)
    5. *Level and Flow Sensors* (`sensor-us01`, `sensor-fs01`)
    6. *Pressure Sensors* (`sensor-pt01`, `sensor-pt02`)
    7. *TDS and Turbidity Sensors* (`sensor-tds01`, `sensor-turb01`)
    8. *ESP32 Controller* (`controller-esp32`)
  - Each item displays:
    - Hardware readiness dot (green = confirmed, amber = planned, cyan = virtual).
    - Component short name.
    - Live telemetry reading in tabular numerals (e.g. `75cm / 188L`, `18.0 L/min`, `850 ppm`).
    - Alarm severity indicator (pulsing red dot on critical, amber dot on warning).
  - Hovering an equipment item triggers 3D highlight; clicking focuses the camera and opens the inspector.

### C. Right Contextual Component Inspector (`ComponentInspector.tsx`)
- **Dimensions:** 340px wide right drawer, slides in only when a component is selected; dismissed via `X` button.
- **Hierarchy:**
  1. Header: Category badge, Component ID, Component Name, and Close button.
  2. Telemetry Card (first for sensors): Large 30px tabular telemetry value with engineering unit, measurement validity (`VALID`, `OUT OF RANGE`, `UNAVAILABLE`, `INVALID`), alarm severity (`NORMAL`, `WARNING`, `CRITICAL`), connection status (`Sim Online` / `Disconn.`), and operating envelope.
  3. Diagnostic & Scientific Advisory: Explicit water quality guidance for TDS and Turbidity (clarifying that electrochemical readings alone do not prove potability).
  4. Deployment Readiness: Confirmed Hardware, Planned Hardware, or Virtual Model.
  5. System Description: Engineering description.
  6. Technical Specifications: Compact key-value specifications.
  7. Skid Mounting & Position: Physical installation and 3D coordinate vector.

### D. Bottom Simulation Control Dock (`SimulationDock.tsx`)
- **Positioning:** Centered at `bottom-4 left-1/2 -translate-x-1/2`, restrained height (48px).
- **Active Scenario Indicator:** Compact `Scenario: Normal Operation` badge with real-time status dot.
- **Controls Group:** `Pause`/`Resume` toggle, `+1s` deterministic step advancement, and `Reset` button.
- **Telemetry KPIs Group:** Elapsed time $T$ in seconds, Reservoir Level & Volume (`75.0 cm (187.5 L)`), and Net Flow balance (`+0.0 L/min`).
- **System Health Pill:** Dynamic alarm status (`SYSTEM NORMAL` in green, `1 WARNING` in amber, or `1 CRITICAL` in pulsing rose).
- **Floating Advisory Banner:** When active faults or scientific advisories are present, a compact banner floats neatly above the dock without obstructing the 3D model.

### E. Header Legend Access Popover (`LegendDrawer.tsx`)
- **Header Placement:** Dedicated `Legend` button with tooltip in the top header.
- **Contents:**
  - Hardware Readiness Tiers (Confirmed, Planned, Virtual) with functional definitions.
  - 1:1 Metric Skid Engineering Dimensions (1.80m × 0.80m × 1.60m, 250 L calibrated reservoir, 2.50 L/cm liquid height).
  - Scientific Observation Guidance note on electrolytic conductivity and nephelometric clarity.

---

## 5. Verification Results

### A. TypeScript Type Check
```bash
npx tsc --noEmit
# Exit Code: 0 (Zero errors)
```

### B. Jest Unit Tests
```bash
npm test
# 16/16 test suites passed in 942ms
# All mathematical models, mass balance, thresholds, and boundary conditions verified
```

### C. ESLint Static Code Analysis
```bash
npm run lint
# Exit Code: 0 (0 errors, 0 warnings)
```

### D. Production Build
```bash
npm run build
# Turbopack optimized production build compiled in 13.0s
# Static pages prerendered (6/6)
# Route /simulator (267 kB JS / 381 kB total First Load JS)
```

### E. Browser Subagent E2E Verification
Conducted automated browser verification against the running production server on `http://localhost:3000/simulator`:
1. **Initial Load:** Verified clean header, left sidebar, 3D viewport, compact bottom dock, and uncollided sensor pucks.
2. **Camera Focus & Interaction:** Clicked `Flow FS-01` in the equipment tree; verified smooth 3D camera zoom to the sensor, expansion of the sensor label (`18.0 L/min`), opening of the Component Inspector drawer, and dismissal via the `X` button.
3. **Multi-Angle Views:** Switched to `Front Elevation`, `Pump & Manifold`, and back to `Overview` via `Reset View`. Confirmed that sensor pucks remain clear and non-overlapping from every perspective.
4. **Scenario Switching:** Selected `Elevated TDS`; confirmed active scenario highlight, appearance of the advisory banner above the bottom dock, critical alarm badge (`1 CRITICAL`), and 850 ppm warning status.
5. **Sidebar Collapse & Restore:** Collapsed the sidebar to maximize 3D canvas area; restored it using the floating `Sidebar` button without layout shifting.

---

## 6. Changed Files Index

| File Path | Description of Changes |
| :--- | :--- |
| `src/components/simulator/SensorPlaceholder.tsx` | Replaced permanent wide billboards with 28px industrial pucks in rest state; added smooth expansion on hover/select; z-index elevation. |
| `src/components/simulator/WaterTank.tsx` | Fixed water level clamping from 0.05m down to 0.0m to accurately display empty tank states (0.0 L). |
| `src/components/simulator/SkidFrame.tsx` | Subdued floor gridHelper lines from neon cyan (`#06B6D4`) to muted industrial slate (`#334155`, `#161F30`). |
| `src/components/simulator/interaction/SimulatorSidebar.tsx` | **New file:** Collapsible left sidebar housing all 7 deterministic scenarios and categorized equipment tree with live telemetry. |
| `src/components/simulator/interaction/SimulationDock.tsx` | **New file:** Compact bottom simulation dock with playback controls, KPIs, alarm summary, and floating advisory banner. |
| `src/components/simulator/interaction/ComponentInspector.tsx` | Refined contextual drawer styling, elevated telemetry card to top priority, added clear validity and alarm badges, clean close button. |
| `src/components/simulator/interaction/LegendDrawer.tsx` | **New file:** Header legend popover presenting hardware readiness tiers, 1:1 metric skid specifications, and scientific advisory. |
| `src/components/simulator/SimulatorShell.tsx` | Complete layout overhaul: 56px SCADA header, left sidebar integration, bottom dock integration, contextual inspector, and camera view presets. |
| `docs/ui-redesign-report.md` | **New file:** Comprehensive documentation of redesign objectives, architectural solutions, and verification logs. |

---

## 7. Deliverable Artifacts

- **Browser Verification Recording:** `aquasage_ui_redesign_verification_1792291908145.webp`
- **Pristine Overview Screenshot:** `pristine_overview_sidebar_1792292127812.png`
- **Component Inspection Screenshot:** `flow_fs01_inspection_1792291934798.png`
- **Multi-Angle Pump Screenshot:** `pump_manifold_view_1792291986941.png`
- **Elevated TDS Scenario Screenshot:** `elevated_tds_scenario_1792292034872.png`
- **Collapsed Sidebar Screenshot:** `sidebar_collapsed_1792292077959.png`
