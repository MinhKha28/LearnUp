# LearnUP Codex Instructions

Use the repository skills under `.agents/skills/`.

For frontend architecture, React/TypeScript structure, routing, services, types,
imports, naming, SCSS conventions, provider placement, and folder organization:

`.agents/skills/learnup-frontend/SKILL.md`

For Figma-to-code, branding, layout, typography, spacing, responsive behavior,
Ant Design UI, visual states, accessibility, and role-specific UX:

`.agents/skills/learnup-ui-design/SKILL.md`

When implementing UI from Figma, use BOTH skills.

General rules:

- Preserve the existing LearnUP repository structure.
- Prefer incremental changes over large rewrites.
- Do not introduce unnecessary architectural layers.
- Do not invent unsupported business rules, permissions, prices, statuses,
  features, AI capabilities, integrations, customers, statistics, or legal claims.
- Approved LearnUP Figma is the visual source of truth when accessible.
- Keep production UI English unless explicitly requested otherwise.
- Do not create a `constants/` folder or `routes.ts` at the current stage.
- Keep route definitions directly in `src/router.tsx`.
- Use regular `.scss`, never `.module.scss`.
- Use simple prefixed kebab-case class names, not BEM `__`.
- Keep global providers/configuration in `src/main.tsx`, not in layouts.
- Do not add LearnUP color theme tokens to `ConfigProvider` at the current stage.
- Keep LearnUP visual tokens in `src/styles/global.scss`.

- Multi-part filenames use dot-separated naming: `plan.card.tsx`, `registration.steps.tsx`, `layout.admin.tsx`.
- Multi-word folder names use kebab-case, not dot naming.
- Create component subfolders only for clear groups of 2–3+ related reusable files/components.
- Keep global layout foundations in `global.scss`; keep role-specific layout styles in their own SCSS files.
- Never make Guest layout classes the shared styling contract for Admin/Organizer/Instructor/Learner.
- Use the project's installed Ant Design version **5.21.6**. Do not write code against APIs from a newer Ant Design version unless the dependency is explicitly upgraded first.
- Prefer matching TSX/SCSS base names: `registration.tsx` ↔ `registration.scss`, `plan.card.tsx` ↔ `plan.card.scss`.
