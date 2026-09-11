# Plan Maestro Constructor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local read-only `Plan Maestro` module in `newcrm` backed by one structured JSON source and a generated Markdown summary.

**Architecture:** `docs/constructor/plan-maestro-constructor.json` is the only source of truth. Backend service validates it, calculates summary/progress, exposes `GET /api/project-plan/constructor`, and a script regenerates `docs/constructor/00-PLAN-MAESTRO-CONSTRUCTOR.md`. `frontend/app.html` renders `#/plan-maestro` with filters, search, summary cards, table, and detail panel.

**Tech Stack:** Node.js ESM, Express, `node:test`, static SPA in `frontend/app.html`, JSON file under `docs/constructor`.

---

### Task 1: Contract Tests

**Files:**
- Create: `backend/test/project-plan-contract.test.js`
- Create: `backend/test/project-plan-ui-contract.test.js`

- [ ] **Step 1: Write failing backend contract tests**

Create tests that import `backend/src/services/projectPlanService.js` and assert JSON validation, unique IDs, valid states, calculated percentage, visible blocking case, local/production separation, generated Markdown content, and that no commercial-rule files import the Plan Maestro service.

- [ ] **Step 2: Run backend contract tests and verify RED**

Run:

```powershell
node --test backend\test\project-plan-contract.test.js
```

Expected: fail because `projectPlanService.js` and JSON source do not exist.

- [ ] **Step 3: Write failing UI contract tests**

Create tests reading `frontend/app.html` and asserting nav link `#/plan-maestro`, route handler `viewPlanMaestro`, API call `/api/project-plan/constructor`, filter/search controls, blocker rendering, and local/production columns.

- [ ] **Step 4: Run UI contract tests and verify RED**

Run:

```powershell
node --test backend\test\project-plan-ui-contract.test.js
```

Expected: fail because the route and UI do not exist.

### Task 2: JSON Source And Backend Service

**Files:**
- Create: `docs/constructor/plan-maestro-constructor.json`
- Create: `backend/src/services/projectPlanService.js`

- [ ] **Step 1: Create initial JSON source**

Add the 20 initial areas from the approved design. Keep implemented-local-but-not-real-validated items as `en_validacion`. Keep `REDPLUS $60 vs BREDP1 $65` as `bloqueado_seguridad`.

- [ ] **Step 2: Implement service**

Implement:

- `VALID_PLAN_STATES`
- `STATE_WEIGHTS`
- `loadProjectPlan(filePath?)`
- `validateProjectPlan(plan)`
- `summarizeProjectPlan(plan)`
- `renderProjectPlanMarkdown(plan)`

The service must not connect to PostgreSQL and must not import Motor Comercial modules.

- [ ] **Step 3: Run backend contract tests and verify GREEN**

Run:

```powershell
node --test backend\test\project-plan-contract.test.js
```

Expected: pass.

### Task 3: Markdown Generation

**Files:**
- Create: `scripts/generate-plan-maestro-constructor-md.mjs`
- Create: `docs/constructor/00-PLAN-MAESTRO-CONSTRUCTOR.md`

- [ ] **Step 1: Create generator script**

The script loads the JSON with `loadProjectPlan()`, renders Markdown with `renderProjectPlanMarkdown()`, and writes `docs/constructor/00-PLAN-MAESTRO-CONSTRUCTOR.md`.

- [ ] **Step 2: Run generator**

Run:

```powershell
node scripts\generate-plan-maestro-constructor-md.mjs
```

Expected: Markdown file exists and includes the calculated percentage, blockers, local/production states, and source notice.

- [ ] **Step 3: Run backend contract tests again**

Run:

```powershell
node --test backend\test\project-plan-contract.test.js
```

Expected: pass.

### Task 4: API Route

**Files:**
- Create: `backend/src/routes/projectPlanRoutes.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Add read-only route**

Create an Express router exposing:

`GET /project-plan/constructor`

It returns `loadProjectPlan()` with calculated summary. Use `requireAuth` and `requireAdmin` when mounting in `server.js`.

- [ ] **Step 2: Mount route**

Mount with:

`app.use('/api', requireAuth, requireAdmin, projectPlanRouter)`

Do not add write endpoints.

- [ ] **Step 3: Add route contract assertion**

Extend `project-plan-contract.test.js` to assert `backend/src/server.js` mounts `/api` with `projectPlanRouter` and that the route file has no `post`, `patch`, `put`, or `delete`.

- [ ] **Step 4: Run route checks**

Run:

```powershell
node --test backend\test\project-plan-contract.test.js
node --check backend\src\server.js
node --check backend\src\routes\projectPlanRoutes.js
```

Expected: pass.

### Task 5: CRM UI

**Files:**
- Modify: `frontend/app.html`

- [ ] **Step 1: Add compact CSS**

Add Plan Maestro CSS near existing dashboard styles. Keep it compact, table-first, and responsive.

- [ ] **Step 2: Add navigation**

Add `Plan Maestro` link to the CRM side navigation. Vendedores remain blocked by the existing route guard and hidden by the seller profile allowed set.

- [ ] **Step 3: Add state and renderer**

Add:

- `pmFilter`
- `pmSearch`
- `pmSelectedId`
- `setPlanMaestroFilter(filter)`
- `selectPlanMaestroItem(id)`
- `renderPlanMaestroStatus(status)`
- `viewPlanMaestro()`

The view fetches `/api/project-plan/constructor` and renders summary cards, filters, search, table, blocker notices, and detail panel.

- [ ] **Step 4: Wire router**

Add route case:

`else if(route==='plan-maestro') html=await viewPlanMaestro();`

- [ ] **Step 5: Run UI contract tests**

Run:

```powershell
node --test backend\test\project-plan-ui-contract.test.js
```

Expected: pass.

### Task 6: Final Verification

**Files:**
- All files above

- [ ] **Step 1: Run targeted tests**

Run:

```powershell
node --test backend\test\project-plan-contract.test.js backend\test\project-plan-ui-contract.test.js
node --check backend\src\services\projectPlanService.js
node --check backend\src\routes\projectPlanRoutes.js
node --check backend\src\server.js
```

Expected: all pass.

- [ ] **Step 2: Confirm no forbidden work**

Check git diff and confirm no migration files, deploy scripts, Motor Comercial behavior, `autoaplica`, fallback removal, production files, or commercial rules were changed by this task.

- [ ] **Step 3: Report**

Report local URL `http://localhost:4000/#/plan-maestro`, calculated percentage, visible blockers, pending items, modified files, tests, and confirm no deploy/migrations/Motor changes.
