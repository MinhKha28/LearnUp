---
name: learnup-ui-design
description: >
  Apply the LearnUP visual language, Figma-to-code workflow, branding,
  typography, spacing, layout, responsive behavior, regular SCSS styling,
  Ant Design conventions, UI states, accessibility, and role-specific UX.
---

# LearnUP UI Design Skill

Use this skill whenever creating, implementing, reviewing, or refining LearnUP UI.


All source paths below are relative to frontend/. Read the
[frontend architecture skill](../learnup-frontend/SKILL.md) for placement, naming,
SCSS and providers. Those conventions are defined there and remain required here.

## Visual source of truth

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

## Product identity

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

## Brand colors

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

## Logo

Preserve:

```text
Main symbol   #1E293B
Person        #F59E0B
Learn         #1E293B
UP            #F59E0B
```

Never recolor randomly, distort, apply gradients, or add heavy glow/shadow.

## Core color tokens

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

## Typography

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

## Spacing

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

## Layout

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

## Responsive

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

## Surfaces

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

## Radius and shadows

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

## Buttons

Hierarchy:

```text
Primary
Secondary
Tertiary/Text
Danger
```

Danger uses Error red, not Amber.

Avoid competing primary CTAs.

## Forms

Every field has a visible label.

Do not rely on placeholder-only labels.

Use sections/steps for long forms.

Validation must be clear and not color-only.

## Tables

Use for enterprise operational data.

Support when appropriate:

- clear columns
- filters
- pagination
- status tags
- compact row actions
- overflow menus

## Statuses

```text
Success → active/completed/approved/published
Warning → pending/expiring/attention/overdue
Error   → rejected/suspended/failed/violation
Info    → neutral informational
```

Always include readable status text.

## UI states

Every data-driven screen should consider:

```text
Loading
Empty
Error
Success
Confirmation
```

Do not implement only the happy path.

## Navigation

Navigation reflects role permissions.

Do not show inaccessible modules.

Active item must be clear.

Avoid coloring every icon Amber.

## Guest UI

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

## Guest Home

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

## Login

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

## Register

Placement:

```text
pages/guest/register.tsx
pages/guest/register.scss
```

Follow the actual LearnUP/Figma registration workflow.

Do not assume generic consumer registration if the approved flow is organization/service registration.

## Role UX

Admin prioritizes platform overview, organizations, plans, configuration, moderation and suspended organizations.

Organizer prioritizes people, instructors, learners, bulk import, course approval,
courses, assignments, progress, assessments, certificates, reports, moderation,
subscription and settings.

Instructor prioritizes My Courses, Create Course, Course Versions, Course Builder,
submissions, Peer Review, grading, learner progress and reports.

Learner prioritizes Required Training, deadlines, progress, assessments,
certificates and Optional Courses.

## Course Builder

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

## Dashboard

Dashboards should answer:

```text
What requires attention?
What is the current status?
What should the user do next?
```

Prefer KPI summary, alerts, pending work and operational lists/tables.

Avoid decorative charts without business value.

## Ant Design

Use the Ant Design version installed in frontend/package.json. Preserve the
compatibility and provider rules in the architecture skill instead of assuming
newer APIs or copying LearnUP tokens into ConfigProvider.

## Figma-to-code workflow

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

## Decision priority

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

## Accessibility

Maintain:

- readable contrast
- focus/hover/active/disabled states
- visible labels
- accessible icon-only actions
- touch-friendly controls
- non-color-only status communication

## UI language

Production UI is English unless explicitly requested otherwise.

Do not mix English and Vietnamese in the same production interface.

## Terminology

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

## Do not invent

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

## Visual restraint

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

## Final UI checklist

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

## Practical rule

Choose the simplest implementation that:

- matches approved Figma
- fits the current repository
- is easy for the team to understand
- satisfies the task
- avoids over-engineering
