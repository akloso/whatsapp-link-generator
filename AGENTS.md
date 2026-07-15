# AGENTS.md

## Repository Purpose

This repository contains **Zapora**, a public-facing collection of WhatsApp and utility tools.

Primary product areas include:

- WhatsApp Link Generator
- Bulk WhatsApp Link Generator
- QR Code Editor
- WhatsApp Button Maker
- Blog
- ICR Trends Dashboard access
- external HTML & Widget Preview access
- Privacy, Terms, and Contact pages

Production site:

- `https://www.zapora.in/`

## Technology

Current stack:

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Lucide React
- Supabase where already used
- QRCode and jsQR where already used

Primary validation commands:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

Do not add a dependency when the existing stack or a small local implementation can solve the problem cleanly.

Do not replace the existing architecture or routing model unless the user explicitly requests it.

## Source-of-Truth Files

Inspect these before changing shared product structure:

- `src/App.tsx` — page routing and application composition
- `src/components/Header.tsx` — canonical Zapora header and navigation
- `src/components/Footer.tsx` — canonical Zapora footer
- `src/index.css` — global tokens and baseline behavior
- `public/logo.svg` — canonical logo

Important product components include:

- `src/components/Generator.tsx`
- `src/components/BulkLinkGenerator.tsx`
- `src/components/QrCodeEditorPage.tsx`
- `src/components/WhatsAppButtonMaker.tsx`
- `src/components/BlogListPage.tsx`
- `src/components/BlogPostPage.tsx`
- `src/features/icr-trends-dashboard/IcrTrendsDashboardRoute.tsx`

The current shared Header and Footer are the source of truth. Reuse them across internal Zapora pages rather than reengineering approximate copies.

## External Tool Relationship

The standalone HTML & Widget Preview lives in:

- repository: `akloso/HTML---Widget-Preview`
- live URL: `https://akloso.github.io/HTML---Widget-Preview/`

It is exposed under:

- All Tools
- Other Tools
- HTML & Widget Preview

Do not embed arbitrary executable widget code directly into the main Zapora application without explicit approval. Keep the standalone preview isolated from the main production site.

## Product and Brand Direction

Zapora should feel:

- clean
- lightweight
- modern
- approachable
- vibrant without becoming noisy
- fast and responsive
- consistent across every tool

The interface should not be only black, white, and green. Use supporting colors intentionally where they improve hierarchy, tool identity, or interaction feedback.

Prefer:

- light backgrounds with subtle color washes
- Zapora emerald as the core brand color
- carefully chosen supporting blue, violet, amber, cyan, coral, or similar accents
- clear hierarchy
- compact, readable typography
- responsive layout
- meaningful interaction feedback
- tasteful motion
- polished empty, loading, success, and error states
- consistent controls across tools

Avoid:

- heavy glass effects
- excessive dark surfaces
- large areas of bold black text
- repetitive cards and borders
- generic template-like sections
- excessive gradients
- neon effects
- distracting infinite animations
- excessive helper text
- decorative elements without a UX purpose
- inconsistent header or footer variants

Use the system/Tailwind sans stack unless the project explicitly adopts a new font system.

Respect `prefers-reduced-motion`.

## Codex Working Standard

Do not treat tasks as mechanical checklists.

Before implementation:

1. Read this file.
2. Inspect the current component, adjacent components, shared Header/Footer, global styles, and recent relevant changes.
3. Understand the complete user flow, not only the isolated control being edited.
4. Identify protected behavior, dependencies, responsive constraints, and deployment impact.
5. Confirm the working branch is based on the latest `main` before large overlapping changes.

Use independent product, UX, and engineering judgment.

You may introduce thoughtful improvements that were not explicitly listed when they materially improve:

- usability
- clarity
- responsiveness
- accessibility
- performance
- maintainability
- visual quality
- interaction feedback
- consistency with the wider product

Do not add random features merely to appear comprehensive.

Every extra enhancement must:

- serve a clear user or engineering purpose
- fit Zapora's existing product direction
- preserve working behavior
- remain accessible
- remain performant
- avoid unnecessary complexity
- avoid unnecessary dependencies
- avoid clutter and gimmicks

For UI/UX tasks, combine related requirements into one coherent visual and interaction system. Think beyond literal component changes when a stronger end-to-end experience is possible.

Examples of acceptable initiative include:

- improving hierarchy while implementing a requested control
- adding meaningful loading or completion feedback
- improving mobile behavior discovered during implementation
- unifying inconsistent spacing or control states
- adding restrained mode-aware or cursor-aware interaction when it supports usability and performance
- moving advanced options out of the primary path

Do not stop merely because the code compiles. Review the rendered product and refine obvious weaknesses.

## Required Quality Passes

Before completion, perform separate passes for:

1. Functional correctness
2. Type safety and maintainability
3. Visual hierarchy and typography
4. Interaction and motion
5. Responsive behavior
6. Accessibility
7. Performance and security
8. Final rendered-product refinement

Correct major weaknesses discovered during these passes.

## Shared Header and Footer Rules

- Use the canonical `Header.tsx` and `Footer.tsx` for internal pages.
- Do not create page-specific imitations unless technically unavoidable.
- Keep desktop and mobile navigation behavior consistent.
- Preserve All Tools and Other Tools behavior.
- Prevent nested menus from overflowing the viewport.
- Keep keyboard, focus, outside-click, Escape, and responsive behavior intact.
- Avoid glass effects unless explicitly requested.
- Keep logo sizing and shared max-width behavior consistent.

When changing Header or Footer, inspect every route that consumes them.

## UI Implementation Rules

- Prefer existing Tailwind patterns and project tokens.
- Reuse existing components and interaction conventions.
- Use Lucide icons instead of inconsistent text symbols when practical.
- Do not hardcode repeated design values across many files when a shared token or component is appropriate.
- Do not overabstract one-off layout code.
- Keep component responsibilities understandable.
- Preserve semantic HTML.
- Do not hide essential labels merely for visual minimalism.
- Keep primary actions obvious.
- Keep destructive or reset actions visually quieter than primary actions.

## Responsive Requirements

Review relevant pages at minimum around:

- 320px
- 360px
- 390px
- 430px
- 768px
- 1024px
- desktop

Ensure:

- no horizontal scrolling
- no clipped menus or controls
- readable forms and editor areas
- usable touch targets
- intentional stacking and spacing
- no fixed widths that break smaller screens
- header and footer remain consistent

## Accessibility Requirements

Preserve or improve:

- semantic structure
- visible focus states
- keyboard navigation
- correct button and link semantics
- accessible names for icon-only controls
- form labels and errors
- ARIA state only where necessary
- sufficient contrast
- reduced-motion behavior
- logical heading order
- practical touch targets

Do not use color as the only signal.

## Performance and Security

- Do not expose secrets, service keys, or private configuration.
- Do not move server-sensitive values into browser code.
- Do not weaken existing validation or sanitization without explicit justification.
- Do not add arbitrary executable third-party scripts to the main site without approval.
- Lazy-load heavy or noncritical functionality where appropriate.
- Avoid unnecessary rerenders and oversized assets.
- Preserve SEO metadata and canonical behavior when changing page structure.
- Confirm external links use the intended absolute destination.

## Testing and Validation

Run all applicable commands:

- `npm run typecheck`
- `npm run lint`
- `npm run build`

Also perform targeted functional checks for the changed flow.

For UI work, review:

- desktop
- mobile
- keyboard behavior
- focus states
- loading, empty, success, and error states
- browser console
- affected navigation and shared layout

When a browser is unavailable, state that clearly. Do not claim visual, interaction, or breakpoint testing that was not performed.

## Branch and Merge Hygiene

- Start work from the latest `main`.
- Use a focused feature or Codex branch.
- Before opening or updating a PR, incorporate current `main` when overlapping shared files have changed.
- Do not overwrite newer merged work.
- Resolve conflicts deliberately and report what was preserved.
- Keep commits focused and understandable.
- Do not claim a remote branch, PR, test, or deployment exists unless it actually exists.
- Do not merge into `main` unless the user explicitly requests the merge.

## Completion Report

Report:

- repository and branch
- commit hash
- files changed
- user-facing improvements
- protected behavior preserved
- tests run and exact outcomes
- responsive widths actually reviewed
- accessibility checks
- browser review performed or unavailable
- limitations and follow-up risks

Never claim pixel-perfect consistency, complete testing, security, or exact source matching without evidence.

## Maintaining This File

Do not modify this file during ordinary feature work.

Update it only when the repository's architecture, shared source-of-truth files, product direction, deployment model, security constraints, or standing quality requirements materially change.