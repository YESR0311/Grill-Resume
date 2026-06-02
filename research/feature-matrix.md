# 简历 external feature matrix

> Scope: `rmx/简历/` remix planning. `external/` is read-only.
> Sources: README/AGENTS summaries, `manifest.json`, Repomix metadata-only map.

## Feature matrix

| Feature | resume-alchemist | resumify | shushu-internship-resume-optimizer | wzdnzd-resume | zineyu-resume | rmx direction |
|---|---|---|---|---|---|---|
| Resume editing | Basic content input + templates | No full editor | No full editor | Full web editor | Full desktop editor | Own web editor in `app/`; do not import desktop stack early |
| Resume optimization | AI diagnosis, roast review, STAR polish, JD matching | Experience-to-competitive wording | Material audit, risk flags, ranking | Mostly manual editing | AI optimize + JD analysis | Combine: diagnostic rubric + evidence/risk audit + JD targeting |
| Templates | Resume templates | Content guide | Output templates for resume/interview | Visual resume templates/data | Desktop templates/data | Define template schema once in owned app |
| Export | PDF | Markdown/content output | Resume text/interview output | PDF/image/JSON | PDF/PNG/JPG/WEBP/SVG/JSON | Start PDF+JSON; image export later |
| Storage | Supabase backend | Files/content | Files/material pipeline | browser localStorage | Tauri local file | Start local browser storage or app DB; defer cloud sync |
| AI provider | SiliconFlow/Supabase functions | N/A | Script pipeline, risk checks | TODO AI service | Configurable AI | Own provider abstraction; no hardcoded vendor |
| JD matching | Yes | No | Indirect via material targeting | TODO | Yes | Core feature candidate |
| Project material input | Resume text/file | Internship experience | Code repo + project summary + business docs | Resume JSON | Resume JSON | Shushu-style evidence pipeline valuable |
| User center | No | No | No | Strong local resume manager | Strong desktop board/user center | Adopt web user center first |
| Desktop app | No | No | CLI/scripts | No | Tauri v2 | Future track only; license unknown |
| License gate | MIT | MIT | Apache-2.0 | MIT | UNKNOWN | zineyu = architecture-reference-only until license resolved |

## Recommended owned modules

| Owned module | Borrow ideas from | Notes |
|---|---|---|
| `ResumeEditor` | wzdnzd-resume, zineyu-resume | Web-first editor; keep storage/export independent |
| `ResumePreview` | wzdnzd-resume, zineyu-resume | One source of truth for preview/export HTML |
| `ResumeStore` | wzdnzd-resume, zineyu-resume | Start local/browser; leave desktop adapter seam |
| `ExportService` | wzdnzd-resume, zineyu-resume | PDF+JSON first; images later |
| `AiOptimizeService` | resume-alchemist, zineyu-resume | Provider abstraction; no vendor lock-in |
| `EvidenceAuditService` | shushu-internship-resume-optimizer, resumify | Convert project material → resume bullets + risk flags |
| `JdMatchService` | resume-alchemist, zineyu-resume | JD match score + missing keyword suggestions |
| `TemplateSchema` | wzdnzd-resume, resume-alchemist | Stable internal schema before UI polish |

## Use / avoid decisions

### Use

- `resume-alchemist`: AI diagnosis dimensions, STAR polish flow, JD matching UX
- `resumify`: phrasing of internship/project achievements
- `shushu-internship-resume-optimizer`: evidence-first audit, risk labels, ranking
- `wzdnzd-resume`: user center, web editor, localStorage, PDF/image/JSON export ideas
- `zineyu-resume`: desktop local file architecture and AI settings as future reference only

### Avoid

- Copying `zineyu-resume` code while license unknown
- Importing Supabase-specific architecture from `resume-alchemist`
- Mixing Next.js web app and Tauri desktop assumptions in one first version
- Letting export logic diverge from preview rendering
- Treating external data JSON/schema as app source of truth before internal schema is defined

## Suggested MVP path

1. Define internal `ResumeData` + `TemplateSchema`
2. Build web editor + preview + local persistence
3. Add PDF/JSON export
4. Add AI provider abstraction
5. Add JD matching + evidence audit
6. Defer desktop/Tauri until web model stable
