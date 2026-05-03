# Feature Specification: UI Redesign — Claude Design System

**Feature Branch**: `003.5-ui-redesign-claude-design`  
**Created**: 2026-05-03  
**Status**: Draft  
**Depends On**: F003 (AI Code Assistant + Graph-Enhanced RAG Pipeline)  
**Priority**: Medium

## Clarifications

### Session 2026-05-03

- Q: Should UI components be built from scratch or on accessible headless primitives? → A: Headless library (accessible primitives styled with project design tokens — not built from scratch)
- Q: Does the Graph Visualisation panel have an existing visual layer to reskin, or is it built from zero? → A: Reskin existing GraphPanel component — preserve working data binding, redesign the visual layer only
- Q: What is the primary brand colour anchor for the Claude-inspired palette? → A: Neutral-warm palette — predominantly neutral greys with amber/orange as the primary accent colour
- Q: What navigation items appear in the sidebar? → A: Four feature panels (Chat, Document Q&A, Code Assistant, Graph Visualisation) plus Settings
- Q: When a user clicks retry on a failed operation, does it auto-execute or navigate to a reset state? → A: Automatic re-execution — retry immediately re-triggers the failed operation without navigation

## User Scenarios & Testing *(mandatory)*

### User Story 1 - First Impression Visual Quality (Priority: P1)

A recruiter or portfolio reviewer visits the application for the first time and immediately recognises a professional, polished AI-assistant product. The visual presentation signals craft and intentionality without requiring deep interaction.

**Why this priority**: The primary motivation for this feature is portfolio impact. First impression carries the most weight when recruiters evaluate a project.

**Independent Test**: Can be fully tested by opening the app in a fresh browser tab and evaluating whether the layout, branding, and visual identity appear coherent, professional, and intentionally designed.

**Acceptance Scenarios**:

1. **Given** a recruiter opens the app URL, **When** the page loads, **Then** they see a branded logo, clean navigation, and a coherent visual identity matching Claude's neutral-warm aesthetic (neutral grey base with amber/orange accent).
2. **Given** a recruiter views the app in both light and dark mode, **When** they switch between modes, **Then** all panels maintain consistent colour, typography, and spacing with no visual regressions.

---

### User Story 2 - Consistent Cross-Panel Experience (Priority: P2)

A developer or technical evaluator navigates between the Chat panel, Document Q&A panel, Code Assistant panel, and Graph Visualisation panel. They find that each panel follows identical layout patterns, component styles, and interaction conventions — the app feels like a single product, not four separate tools.

**Why this priority**: Inconsistency across panels signals an unfinished product. A unified design language is the primary quality signal for technical evaluators.

**Independent Test**: Navigate to each panel in turn and verify that spacing, button styles, typography, and colour values are identical. No panel should look like it belongs to a different application.

**Acceptance Scenarios**:

1. **Given** a user is in the Chat panel, **When** they switch to the Code Assistant panel, **Then** the navigation shell and top bar are visually unchanged; only the panel-specific content area differs.
2. **Given** a user inspects any component across any panel, **When** they compare button, input, card, and label styles, **Then** all instances follow the same visual values — no panel introduces its own overrides.

---

### User Story 3 - Feedback During Async Operations (Priority: P3)

A user submits a chat message, uploads a document, or requests code generation. While waiting for results, they see clear visual feedback indicating the system is processing their request. If the operation fails, a retry action immediately re-executes it without requiring any navigation.

**Why this priority**: Async operations are the dominant interaction pattern across all panels. Missing feedback causes perceived bugs; good feedback signals product quality.

**Independent Test**: Trigger each async operation (LLM streaming, document retrieval, code generation, graph query) and confirm appropriate loading indicators appear before results, disappear cleanly on completion, and that clicking retry immediately re-triggers the operation without page navigation.

**Acceptance Scenarios**:

1. **Given** a user sends a chat message, **When** the system is generating a response, **Then** a streaming indicator is visible and updates in real time until the response completes.
2. **Given** a user uploads a document, **When** processing is in progress, **Then** a placeholder occupies the result area and is replaced by real content on completion.
3. **Given** any async operation fails, **When** the error state is displayed and the user activates the retry action, **Then** the failed operation immediately re-executes without any page navigation or additional user input.

---

### User Story 4 - Dark Mode Preference Persistence (Priority: P4)

A user switches the application to dark mode. On their next visit the application restores their preferred mode without requiring re-selection.

**Why this priority**: Preference persistence is a widely expected behaviour that demonstrates attention to user experience. Low scope, high signal for evaluators.

**Independent Test**: Enable dark mode, close the browser, reopen the app, and confirm dark mode is active. Repeat with light mode to confirm the toggle works both directions.

**Acceptance Scenarios**:

1. **Given** a user enables dark mode, **When** they reload the page, **Then** the app opens in dark mode with no flash of light mode during load.
2. **Given** a user switches back to light mode, **When** they reload, **Then** the app opens in light mode.

---

### User Story 5 - Accessible Navigation (Priority: P5)

A user who relies on keyboard navigation or a screen reader can access all primary functions across every panel without using a mouse. All interactive elements have visible focus indicators and descriptive labels.

**Why this priority**: Accessibility demonstrates engineering excellence and is a professional requirement. It is a gating quality criterion for technical hiring managers reviewing the portfolio.

**Independent Test**: Navigate the full application using only Tab, Arrow keys, and Enter. Confirm every interactive element is reachable, labelled, and activatable without a mouse.

**Acceptance Scenarios**:

1. **Given** a keyboard-only user opens the app, **When** they press Tab repeatedly, **Then** focus moves through all interactive elements in a logical order with visible focus rings on every element.
2. **Given** a screen reader user opens any panel, **When** they navigate to an interactive element, **Then** the screen reader announces a meaningful label describing the element's purpose.

---

### Edge Cases

- What happens when the logo asset fails to load? The layout does not break; a text-based brand name renders as fallback.
- What happens if a panel has no data (empty conversation list, no documents uploaded, no graph entities)? Each panel displays a purpose-built empty state with a descriptive message and primary call-to-action.
- What happens if the user's system colour scheme differs from their saved preference? The user's explicit saved preference takes priority over the system setting.
- How does the UI behave at viewport widths below 768px? The sidebar collapses to a hamburger-style navigation and panels reflow to a single column.
- What happens when a streaming response is interrupted mid-generation? The error state replaces the streaming indicator and presents a retry action that immediately re-executes the request.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The platform MUST display a branded wordmark logo in the top bar of every panel, available in a version that works on both light and dark backgrounds.
- **FR-002**: The application MUST provide a colour mode toggle (light / dark) accessible from every panel.
- **FR-003**: The user's colour mode preference MUST be retained across browser sessions on the same device.
- **FR-004**: All panels — Chat, Document Q&A, Code Assistant, Graph Visualisation — MUST share a single set of design tokens for colour, typography, spacing, border radius, and shadow; no panel may introduce overrides. All interactive components MUST use accessible headless primitives so that keyboard navigation, focus management, and ARIA roles are provided by the component layer.
- **FR-005**: Every async operation MUST display a loading or skeleton placeholder before results appear.
- **FR-006**: Every async operation MUST display a friendly error state with a retry action if the operation fails. Activating the retry action MUST automatically re-execute the failed operation without requiring additional navigation or user input.
- **FR-007**: Every panel MUST display a purpose-built empty state with a descriptive message and a primary call-to-action when no data is present.
- **FR-008**: All interactive elements MUST be operable via keyboard alone and MUST display a visible focus indicator when focused.
- **FR-009**: All non-decorative images and interactive controls MUST carry accessible text labels readable by screen readers.
- **FR-010**: Text and background colour combinations MUST meet WCAG AA contrast ratios across both light and dark modes.
- **FR-011**: The application shell MUST be responsive, collapsing the sidebar on narrow viewport widths. The sidebar MUST contain exactly five navigation items: Chat, Document Q&A, Code Assistant, Graph Visualisation, and Settings.
- **FR-012**: Panel transitions and message-arrival animations MUST complete within 300 milliseconds and MUST be suppressed when the user has enabled a "reduce motion" system preference.
- **FR-013**: The platform logo MUST be delivered in multiple sizes: small icon (16px, 32px) for browser contexts and large icon (512px) for application contexts.
- **FR-014**: The Chat panel MUST display LLM streaming output with a real-time streaming indicator that disappears cleanly on completion.
- **FR-015**: The Document Q&A panel MUST display citation cards that link each response passage back to its source document chunk.
- **FR-016**: The Code Assistant panel MUST display generated code with visual syntax differentiation.
- **FR-017**: The Graph Visualisation panel's existing visual layer MUST be redesigned to render knowledge graph nodes and edges with interactive zoom and filtering controls, preserving the existing data bindings.
- **FR-018**: The project README MUST include the platform logo, at least one full-resolution screenshot per panel, and a demonstration GIF of the redesigned application.

### Key Entities

- **Design Token**: A named, reusable visual value (colour, spacing, font size, border radius, shadow) applied consistently across all panels and components. The colour palette uses a neutral-warm scheme: neutral grey base with amber/orange as the primary accent.
- **Shell**: The persistent layout wrapper containing the top bar (logo and global controls) and sidebar navigation (Chat, Document Q&A, Code Assistant, Graph Visualisation, Settings), shared across all panels.
- **Panel**: A full-page feature area (Chat, Document Q&A, Code Assistant, Graph Visualisation) rendered within the Shell.
- **Empty State**: Content displayed in a Panel when no data yet exists, including a descriptive message and primary call-to-action.
- **Loading State / Skeleton Screen**: A placeholder component occupying the expected result area while an async operation is in progress.
- **Error State**: Content displayed when an async operation fails, including a human-readable message and a retry action that immediately re-executes the failed operation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can identify the product as a branded AI assistant within 5 seconds of the page loading, based solely on visual presentation.
- **SC-002**: All four panels and the Shell share 100% of design token values with zero per-panel colour, typography, or spacing overrides.
- **SC-003**: Every async operation displays a loading indicator within 100 milliseconds of the request being initiated, measured from user action to first visual feedback.
- **SC-004**: The application achieves a WCAG AA pass on all colour contrast combinations across both light and dark modes.
- **SC-005**: Keyboard-only navigation reaches 100% of interactive elements across all panels in a single sequential Tab traversal.
- **SC-006**: The user's colour mode preference is restored correctly on 100% of browser reload scenarios.
- **SC-007**: Zero panels fall back to a blank screen or unhandled error boundary under no-data or operation-failure conditions.
- **SC-008**: All panel transitions and micro-interactions complete in under 300 milliseconds and are correctly suppressed when "reduce motion" is enabled.
- **SC-009**: The README contains at minimum one screenshot per panel and one demo GIF showing the full redesigned application in use.

## Assumptions

- The visual design language is inspired by Claude's publicly observable design language: a neutral-warm palette (neutral grey base, amber/orange primary accent) with minimal, confident typography.
- Interactive components are built on accessible headless primitives (not custom-built from scratch), so keyboard navigation, focus management, and ARIA roles are provided by the component layer without bespoke implementation.
- The Graph Visualisation panel has an existing visual component (GraphPanel) that will be redesigned in place; the data bindings and backend integration will be preserved, only the visual layer replaced.
- Dark mode and light mode are both first-class experiences; dark mode is not a secondary afterthought.
- Responsive layout is in scope for viewport collapse at narrower widths; full mobile-optimisation of all panel interactions is out of scope for this version.
- No new authentication, data models, or API changes are required; this feature is entirely presentational.
- All existing feature functionality (chat streaming, document upload and retrieval, code generation, graph query) remains unchanged in behaviour; only the visual layer is modified.
- The demo GIF for the README will be recorded manually after implementation; automated capture tooling is not required.
- The logo design is created as part of this feature and does not require procurement of an external designer.
