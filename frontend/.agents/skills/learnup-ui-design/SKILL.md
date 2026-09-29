---
name: learnup-ui-design
description: >
  Apply the LearnUP visual language, Figma-to-code workflow, branding,
  typography, spacing, layout, responsive behavior, regular SCSS styling,
  Ant Design conventions, UI states, accessibility, and role-specific UX.
---

# LearnUP UI Design Skill

Use this skill whenever creating, implementing, reviewing, or refining LearnUP UI.

## 1. Visual source of truth

Primary Figma reference:

`https://www.figma.com/design/5SCWdZisvCvQ64B9a0or9N/LearnUP?node-id=0-1`

When Figma is accessible:

1. inspect the exact target node;
2. inspect screenshot/design context;
3. inspect variables/tokens where available;
4. identify reusable components;
5. implement using current repository conventions;
6. compare the result against Figma.

Do not redesign approved screens from personal preference.

## 2. Product identity

LearnUP is a professional B2B organizational training management platform.

The UI must feel:

- Professional
- Trustworthy
- Modern
- Structured
- Enterprise-oriented
- Approachable
- Clean
- Calm
- Easy to scan

It must NOT look like:

- Coursera/Udemy
- a public Course marketplace
- a children’s platform
- a generic colorful LMS
- crypto/finance software
- an AI-first product

## 3. Brand colors

Deep Navy:

```text
#1E293B
```

Use for:

- main logo symbol
- word `Learn`
- navigation/sidebar
- strong structural emphasis

Amber:

```text
#F59E0B
```

Use for:

- person element in logo
- word `UP`
- CTA accents
- selected highlights

Recommended visual balance:

```text
White/light surfaces 70–80%
Navy                 15–20%
Amber                  5–10%
```

Amber is an accent, not a dominant background.

## 4. Logo

Preserve:

```text
Main symbol   #1E293B
Person        #F59E0B
Learn         #1E293B
UP            #F59E0B
```

Never recolor randomly, distort, apply gradients, or add heavy glow/shadow.

## 5. Core color tokens

```text
Primary Navy       #1E293B
Accent Amber       #F59E0B
White              #FFFFFF
Page Background    #F8FAFC
Secondary Surface  #F1F5F9
Border             #E2E8F0
Divider            #CBD5E1
Text Primary       #0F172A
Text Secondary     #475569
Success            #059669
Info               #2563EB
Warning            #F59E0B
Error              #DC2626
```

Keep these in `src/styles/global.scss`.

Do not duplicate them in `ConfigProvider` at the current stage.

## 6. Typography

Use Inter.

```text
H1       32–36px
H2       24–28px
H3       20–22px
Body     14–16px
Caption  12–13px
```

```text
Page title       600–700
Section title    600
Card title       500–600
Body             400
Label            500
Button           500–600
```

## 7. Spacing

Use an 8px-based system:

```text
4
8
12
16
24
32
40
48
64
```

Typical:

- icon/text: 8px
- form field gap: 8–12px
- card internal: 16–24px
- section gap: 24–32px
- large section: 40–48px
- desktop page padding: 24–32px

## 8. Layout

Primary desktop reference:

```text
1440 × 1024
```

Authenticated app:

```text
Sidebar expanded   240–272px
Sidebar collapsed   72–80px
Header               64–72px
```

Guest:

```text
Header
Main Content
Footer
```

Authenticated:

```text
Sidebar
Top Header / Topbar
Main Content
```

## 9. Responsive

Target:

```text
1440px
1280px
768px
375px
```

Do not simply shrink desktop UI.

On smaller screens:

- collapse navigation;
- stack content;
- preserve primary CTA;
- allow table scrolling;
- reduce secondary information;
- avoid overflow.

## 10. Surfaces

Page background:

```text
#F8FAFC
```

Surface:

```text
#FFFFFF
```

Secondary surface:

```text
#F1F5F9
```

Typical card:

```css
background: #ffffff;
border: 1px solid #e2e8f0;
border-radius: 8px;
```

Prefer borders over heavy shadows.

## 11. Radius and shadows

Radius:

```text
6px
8px
10px
12px
```

Default:

```text
8px
```

Use shadows sparingly for dropdowns, popovers, modals and floating menus.

Avoid glassmorphism, glow and decorative heavy shadows.

## 12. Buttons

Hierarchy:

```text
Primary
Secondary
Tertiary/Text
Danger
```

Danger uses Error red, not Amber.

Avoid competing primary CTAs.

## 13. Forms

Every field has a visible label.

Do not rely on placeholder-only labels.

Use sections/steps for long forms.

Validation must be clear and not color-only.

## 14. Tables

Use for enterprise operational data.

Support when appropriate:

- clear columns
- filters
- pagination
- status tags
- compact row actions
- overflow menus

## 15. Statuses

```text
Success → active/completed/approved/published
Warning → pending/expiring/attention/overdue
Error   → rejected/suspended/failed/violation
Info    → neutral informational
```

Always include readable status text.

## 16. UI states

Every data-driven screen should consider:

```text
Loading
Empty
Error
Success
Confirmation
```

Do not implement only the happy path.

## 17. Navigation

Navigation reflects role permissions.

Do not show inaccessible modules.

Active item must be clear.

Avoid coloring every icon Amber.

## 18. Guest UI

Guest UI should be clean, light, professional and B2B-oriented.

Priority pages:

```text
Home
Login
Register
Features
Plans
Plan Detail
Organization Registration
Forgot Password
Reset Password
Invitation Activation
Account Setup
Mock Payment
Payment Result
```

Do not make it look like a public Course marketplace.

## 19. Guest Home

Placement:

```text
pages/guest/home.tsx
pages/guest/home.scss
```

Reuse:

```text
components/layout/header.tsx
components/layout/header.scss
components/layout/footer.tsx
components/layout/footer.scss
```

Preserve approved Figma section order, hierarchy and CTA emphasis.

Do not invent marketing sections, customers, prices, statistics or claims.

## 20. Login

Placement:

```text
pages/guest/login.tsx
pages/guest/login.scss
```

Use Ant Design Form/Input/Button where appropriate.

Consider:

- normal
- validation
- loading
- disabled
- authentication error

Do not redesign the approved layout.

## 21. Register

Placement:

```text
pages/guest/register.tsx
pages/guest/register.scss
```

Follow the actual LearnUP/Figma registration workflow.

Do not assume generic consumer registration if the approved flow is organization/service registration.

## 22. Role UX

Admin prioritizes platform overview, organizations, plans, configuration, moderation and suspended organizations.

Organizer prioritizes people, instructors, learners, bulk import, course approval,
courses, assignments, progress, assessments, certificates, reports, moderation,
subscription and settings.

Instructor prioritizes My Courses, Create Course, Course Versions, Course Builder,
submissions, Peer Review, grading, learner progress and reports.

Learner prioritizes Required Training, deadlines, progress, assessments,
certificates and Optional Courses.

## 23. Course Builder

Desktop:

```text
Left   → Curriculum Tree
Center → Content Editor
Right  → Properties / Version / Lock
```

Hierarchy:

```text
Course
└── Module
    └── Lesson
        ├── Video
        └── Reading
```

## 24. Dashboard

Dashboards should answer:

```text
What requires attention?
What is the current status?
What should the user do next?
```

Prefer KPI summary, alerts, pending work and operational lists/tables.

Avoid decorative charts without business value.

## 25. Ant Design

The frontend currently uses **Ant Design 5.21.6**.

All UI implementation must remain compatible with Ant Design 5.21.6.
Do not use APIs from newer Ant Design releases unless the dependency is explicitly upgraded.

Prefer:

```text
Button
Form
Input
Select
Table
Modal
Drawer
Dropdown
Tooltip
Pagination
DatePicker
Upload
Tag
```

Do not rebuild standard primitives without a design reason.

At the current stage:

- `ConfigProvider` stays in `main.tsx`;
- use it primarily for locale/global Ant Design configuration;
- do not duplicate LearnUP color tokens in `ConfigProvider`;
- visual tokens stay in `global.scss`;
- only introduce Ant Design theme overrides later when explicitly needed.

## 26. Component grouping and SCSS convention

Use role/domain subfolders only when multiple reusable UI components belong to the same clear flow.

Preferred Guest registration grouping:

```text
components/guest/registration/
├── plan.card.tsx
├── plan.card.scss
├── registration.tsx
└── registration.scss
```

Do not create subfolders for isolated one-file components.

Use dot-separated filenames for multi-part files such as:

```text
plan.card.tsx
registration.tsx
course.card.tsx
layout.admin.tsx
```

Folder names remain lowercase or kebab-case, never dot-separated.

Use regular SCSS only.

Do NOT use `.module.scss`.

Preferred:

```text
header.tsx
header.scss
footer.tsx
footer.scss
home.tsx
home.scss
login.tsx
login.scss
register.tsx
register.scss
```

Use simple prefixed kebab-case class names.

Preferred:

```text
.header
.header-title
.header-logo
.header-nav
.header-actions

.footer
.footer-title
.footer-links

.home
.home-hero
.home-section

.login
.login-title
.login-form
.login-submit

.register
.register-title
.register-form
.register-section
```

Do NOT use BEM `__`.

Do NOT use generic names such as:

```text
.title
.wrapper
.content
.item
.button
```

unless intentionally global.

## 27. Global and role-specific layout styling

`src/styles/global.scss` contains global foundations and design tokens only.

Global layout foundations such as `html`, `body`, `#root`, base `main`, reset,
fonts, tokens and accessibility defaults belong in `global.scss`.

Role-specific layout rules stay outside `global.scss`.

Examples:

```text
components/guest/guest.scss
components/layout/layout.admin.scss
components/layout/layout.organizer.scss
components/layout/layout.instructor.scss
components/layout/layout.learner.scss
```

Do not reuse `.guest-layout` as the layout styling contract for Admin, Organizer,
Instructor or Learner.

Only create a role layout SCSS file when that role actually needs its own layout rules.

## 29. global.scss standard

`src/styles/global.scss` contains global foundations and design tokens only.

Do not place page-specific styles in `global.scss`.

Keep:

- LearnUP color variables
- base typography
- reset
- body/root defaults
- form font inheritance
- accessibility focus rules
- global utility rules only when truly shared

## 29. Figma-to-code workflow

For each screen:

1. identify the role;
2. inspect the exact target Figma node when accessible;
3. inspect screenshot/design context;
4. identify visible static assets;
5. identify hierarchy;
6. identify reusable existing components;
7. identify spacing/typography/colors/radius/borders;
8. identify states;
9. identify responsive intent;
10. map files to correct folders;
11. implement with React + TypeScript + Ant Design + regular SCSS;
12. compare against Figma;
13. fix meaningful visual differences;
14. do not modify unrelated screens.

## 30. Decision priority

```text
Approved LearnUP Figma
↓
Existing LearnUP UI pattern
↓
This skill
↓
Ant Design convention
↓
Simplest professional B2B SaaS solution
```

## 31. Accessibility

Maintain:

- readable contrast
- focus/hover/active/disabled states
- visible labels
- accessible icon-only actions
- touch-friendly controls
- non-color-only status communication

## 32. UI language

Production UI is English unless explicitly requested otherwise.

Do not mix English and Vietnamese in the same production interface.

## 33. Terminology

Use:

```text
Admin
Organizer
Instructor
Learner
Guest
Organization
Course
Course Version
Enrollment
Assessment
Assignment
Quiz
Peer Review
Certificate
Subscription
Plan
```

## 34. Do not invent

Do not invent:

- prices
- customer logos
- legal claims
- statistics
- permissions
- business rules
- statuses
- subscription policies
- AI capabilities
- integrations

## 35. Visual restraint

Avoid:

- unnecessary gradients
- glassmorphism
- neon effects
- random bright colors
- oversized decorative illustrations
- excessive shadows
- excessive radius
- meaningless charts
- excessive animation

## 36. Final UI checklist

Verify:

- correct role/page folder
- correct component folder
- naming follows skill conventions
- Header/Footer reused correctly
- LearnUP colors preserved
- logo treatment preserved
- Inter typography
- spacing consistent
- regular `.scss`, not `.module.scss`
- simple prefixed kebab-case class names
- no BEM `__`
- `global.scss` remains global-only
- `ConfigProvider` remains in `main.tsx`
- no duplicate provider in layouts
- no LearnUP theme token duplication in `ConfigProvider`
- responsive behavior handled
- loading/empty/error/success states handled
- permissions reflected
- no unsupported functionality
- no unnecessary dependency
- no unrelated refactor
- visible Figma differences fixed when accessible

## 37. Practical rule

Choose the simplest implementation that:

- matches approved Figma
- fits the current repository
- is easy for the team to understand
- satisfies the task
- avoids over-engineering

## TSX/SCSS file pairing

For UI pages/components, prefer matching TSX and SCSS base names.

Examples:

```text
registration.tsx
registration.scss

plan.card.tsx
plan.card.scss

login.tsx
login.scss
```

Do not make filenames more verbose than necessary when the folder context is already clear.
If dot-separated naming is used, the SCSS file must use the same base name.
