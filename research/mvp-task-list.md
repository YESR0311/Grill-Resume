# 简历 MVP task list

> Planning only. Implementation belongs in `简历/.trellis/` tasks.
> Assumption: Web builder first; AI optimization second; desktop/Tauri track deferred until license and web model stabilize.

## MVP goal

Build a web-first resume editor with preview, local persistence, JSON/PDF export, and a clean internal data model ready for later AI optimization.

## Non-goals

- Tauri desktop app
- Cloud sync / Supabase backend
- Full AI provider integration in first milestone
- Image export parity
- Copying `zineyu-resume` code while license unknown

## Phase 0 — Contracts

| Task | Output | Evidence |
|---|---|---|
| Define `ResumeData` schema | Type/schema document | Example resume validates |
| Define `TemplateSchema` | Template model + one default template | Preview renders default template |
| Define storage interface | `ResumeStore` contract | Browser adapter can be swapped later |
| Define export boundary | `ResumeData -> preview HTML -> PDF/JSON` | Preview/export share data path |

## Phase 1 — Core web builder

| Task | Owned target | External reference | Evidence |
|---|---|---|---|
| Resume list/user center | `app/` | `wzdnzd-resume`, `zineyu-resume` concept | Create/list/delete local resume |
| Resume editor | `app/` | `wzdnzd-resume`, `zineyu-resume` concept | Edit personal info + modules |
| Resume preview | `app/` | `wzdnzd-resume`, `zineyu-resume` concept | Live preview updates |
| Local persistence | `app/` service | wzdnzd localStorage, zineyu storage concept | Reload keeps data |

## Phase 2 — Export

| Task | Owned target | External reference | Evidence |
|---|---|---|---|
| JSON import/export | `app/` service | wzdnzd/zineyu data backup | Export then import round trip |
| PDF export | `app/` service/API | wzdnzd PDF flow | PDF generated from same preview HTML |
| Export error handling | UI/service | wzdnzd fallback UX | Failed PDF gives actionable message |

## Phase 3 — AI-ready seams

| Task | Owned target | External reference | Evidence |
|---|---|---|---|
| AI provider interface | service contract | resume-alchemist, zineyu | Mock provider returns structured suggestions |
| JD matching contract | service contract | resume-alchemist, zineyu | Fixture JD produces match report |
| Evidence audit contract | service contract | shushu, resumify | Project material fixture produces bullet suggestions + risk flags |

## Phase 4 — AI integration (post-MVP)

| Task | Owned target | External reference | Evidence |
|---|---|---|---|
| Resume diagnosis | AI service | resume-alchemist | Score + rubric + suggestions |
| STAR polish | AI service | resume-alchemist, resumify | Before/after bullet diff |
| Project evidence pipeline | AI/service/scripts | shushu | Raw project material → resume-ready bullets |

## First Trellis task recommendation

Create `简历/.trellis/tasks/<date>-resume-mvp-contracts` with:

- deliverable: `ResumeData`, `TemplateSchema`, `ResumeStore`, export boundary specs
- acceptance: one example resume JSON; one default template; one storage adapter decision
- references: `简历/research/feature-matrix.md`, `简历/research/resume-external-map.repomix.md`, `简历/manifest.json`

## Open decisions

1. Web builder first or AI optimization first? Recommended: Web builder first.
2. Storage first target? Recommended: browser local first, leave adapter seam.
3. PDF implementation? Recommended: preview HTML as source of truth; implementation choice after app stack confirmed.
4. Desktop/Tauri? Recommended: defer; `zineyu-resume` remains architecture-reference-only until license confirmed.
