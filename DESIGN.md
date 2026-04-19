# Design System Document

## 1. Overview & Creative North Star: "The Analytical Architect"

This design system moves away from the "generic SaaS" look of the last decade. Instead of flat, boxed-in layouts, we are building **"The Analytical Architect."** This North Star represents a workspace that feels like a high-end physical studio—structured, airy, and hyper-efficient. 

We achieve this through **Editorial Data Storytelling**. We use Manrope for high-impact numbers and headers to give a sense of prestige, paired with Inter for clinical precision in functional UI. We break the "template" look by utilizing intentional asymmetry, expansive white space, and a depth model based on light and material rather than lines and boxes.

---

## 2. Colors & Surface Philosophy

The palette is anchored in professional blues, but its sophistication comes from how those blues are layered.

### The "No-Line" Rule
Standard 1px borders are strictly prohibited for sectioning. Layouts must be defined by **Tonal Shifts**. 
- To separate a sidebar from a main content area, use a shift from `surface` to `surface-container-low`.
- To highlight a specific data module, place a `surface-container-lowest` card atop a `surface-container` background.

### Surface Hierarchy & Nesting
Treat the dashboard as a series of stacked, semi-transparent sheets:
- **Base Layer:** `surface` (#f8f9fa) — The infinite canvas.
- **Sectioning:** `surface-container` (#edeeef) — Large layout blocks.
- **Interaction Layer:** `surface-container-lowest` (#ffffff) — The primary "work surface" for cards and inputs.

### The "Glass & Gradient" Rule
To add soul to "Efficient and Reliable," use **Signature Textures**:
- **Primary CTAs:** Apply a linear gradient from `primary` (#003ec7) to `primary_container` (#0052ff) at a 135° angle.
- **Floating Overlays:** Use `surface_container_lowest` with a 24px Backdrop Blur and 80% opacity to create a "frosted glass" effect for navigation and tooltips.

---

## 3. Typography: The Editorial Balance

We utilize two typefaces to balance "Modern" with "Data-Driven."

- **The Authority (Manrope):** Used for `display` and `headline` scales. Its geometric nature feels architectural and premium.
- **The Utility (Inter):** Used for `title`, `body`, and `label` scales. Its high x-height ensures maximum legibility in dense data tables.

**Key Scales:**
- **Display-LG (Manrope, 3.5rem):** For hero metrics (e.g., Total Reach).
- **Headline-SM (Manrope, 1.5rem):** For page titles and section headers.
- **Label-MD (Inter, 0.75rem):** For status badges and micro-copy, always in Medium or Semi-bold weight.

---

## 4. Elevation & Depth

### The Layering Principle
Hierarchy is achieved through **Tonal Layering**. Instead of a drop shadow on every card, use:
1. `surface-container-low` for the background.
2. `surface-container-lowest` (#ffffff) for the card itself.
3. A "Ghost Border" using `outline-variant` at **10% opacity** only if the surface contrast is less than 1.1:1.

### Ambient Shadows
For floating elements (Modals, Popovers), use "Ambient Light" shadows:
- **Shadow Color:** `on_surface` (#191c1d) at 6% opacity.
- **Values:** `0px 12px 32px -4px`. This creates a soft, natural lift rather than a harsh "pasted-on" appearance.

---

## 5. Components

### Modern Sidebar Navigation
- **Structure:** `surface-container-low` background. No vertical divider.
- **Active State:** A `primary_fixed` background with `on_primary_fixed_variant` text.
- **Interaction:** Hovering an item should shift the background to `surface-container-high` with a `4px` rounded corner (`DEFAULT`).

### Premium Buttons
- **Primary:** Gradient (`primary` to `primary_container`), `xl` (0.75rem) roundedness. Use `on_primary` for text.
- **Secondary:** Transparent background with a "Ghost Border" (`outline-variant` at 20%). 
- **Login/Action:** Large padding (12px 24px) to emphasize intentionality.

### Data Cards & Tables
- **Forbid Dividers:** Do not use lines between table rows. Instead, use a subtle background toggle of `surface` and `surface-container-low` for alternating rows, or simply 16px of vertical whitespace.
- **Status Badges:** 
    - **Connected:** `tertiary_container` background with `on_tertiary_fixed_variant` text.
    - **Disconnected:** `error_container` background with `on_error_container` text.
    - **Shape:** Use `full` (9999px) roundedness for a pill shape.

### Input Fields
- **Resting:** `surface-container-highest` background, no border.
- **Focused:** `surface-container-lowest` background with a 2px `primary` shadow-glow (40% opacity).

---

## 6. Do’s and Don’ts

### Do
- **Do** use `manrope` for any number representing a KPI to give it "weight."
- **Do** allow elements to overlap slightly (e.g., a card bleeding over a section color shift) to create visual depth.
- **Do** use `surface-dim` for inactive or "backgrounded" dashboard widgets.

### Don't
- **Don't** use pure black (#000000) for text; always use `on_surface` to keep the look high-end and soft.
- **Don't** use 100% opaque borders. If a container needs a line, it is a sign the spacing or tonal shift is insufficient.
- **Don't** cram data. If the dashboard feels "busy," increase the Spacing Scale (move from `md` to `xl` gaps).