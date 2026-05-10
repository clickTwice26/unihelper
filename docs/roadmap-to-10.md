# Roadmap to 10/10

Current score: **8.54 / 10**  
Three areas are holding the score back: maintainability (monolith file), data safety (no migration history), and security (weak CSP).

---

## Task 1 — Split `course-detail.tsx` into a feature folder

**Impact**: Code Quality +1.5, Performance (better tree-shaking per tab)  
**Effort**: ~2 h  
**Why**: The file is ~2,900 lines. It's hard to review, impossible to code-split per tab, and every edit risks breaking an unrelated section.

### Target structure

```
app/routes/dashboard/course-detail/
├── index.tsx              ← loader, action, default export (thin shell)
├── types.ts               ← StorageFile, QuizEntry, AssignmentEntry, …
├── helpers.tsx            ← formatBytes, MimeIcon, parseBreadcrumbs, …
├── components/
│   ├── EditModal.tsx
│   ├── FilePreviewModal.tsx
│   └── NewFolderModal.tsx
└── tabs/
    ├── AttendanceTab.tsx
    ├── AssignmentTab.tsx
    ├── ExamTab.tsx
    ├── LinksTab.tsx
    ├── PresentationTab.tsx
    ├── QuizTab.tsx
    └── StorageTab.tsx
```

### Steps

1. Create the directory `app/routes/dashboard/course-detail/`.
2. Move (do **not** copy) `app/routes/dashboard/course-detail.tsx` to `app/routes/dashboard/course-detail/index.tsx`.
3. Extract the `Tab` type, `validTabs` array, and all data types to `types.ts`.
4. Extract helper functions (`formatBytes`, `parseBreadcrumbs`, `MimeIcon`) to `helpers.tsx`.
5. Cut each `*Tab` function component to its own file in `tabs/`. Each file:
   - Imports its own deps (React, lucide, react-router Form/Link, etc.)
   - Exports the component as a named export
   - May import from `../types` and `../helpers`
6. Cut each modal component to `components/`.
7. Update `index.tsx` to import from the extracted files.
8. Update `app/routes.ts` — no change needed if the directory contains `index.tsx`; React Router resolves it automatically.
9. Run `npx tsc --noEmit` to verify no broken imports.

### Checklist
- [ ] `types.ts` created and imported in `index.tsx`
- [ ] `helpers.tsx` created and imported where used
- [ ] All 7 tab files created
- [ ] All 3 modal files created
- [ ] `index.tsx` compiles with no errors
- [ ] Dev server starts and all 9 tabs render correctly

---

## Task 2 — Prisma migration baseline

**Impact**: Architecture +1.0 (production safety, team collaboration)  
**Effort**: 15 min  
**Why**: `db push` directly mutates the database without a history file. In production, schema drift is invisible. `prisma migrate deploy` is the safe deployment path.

### Steps

```bash
# 1. Create the baseline migration (generates SQL from current schema)
npx prisma migrate dev --name init

# 2. Verify the migrations/ folder was created
ls prisma/migrations/

# 3. Update the Dockerfile — replace db push with migrate deploy
#    See exact change below.

# 4. For future schema changes, use:
npx prisma migrate dev --name <describe-change>
# Then commit both prisma/schema.prisma AND prisma/migrations/
```

### Dockerfile change

Find the line in your `Dockerfile` that runs the app (or add a step before it):

```dockerfile
# Before starting the server, apply pending migrations (safe in production)
RUN npx prisma generate
CMD ["sh", "-c", "npx prisma migrate deploy && node build/server/index.js"]
```

> **Note**: `migrate deploy` only applies already-generated migrations. It never auto-generates. Safe to run on every container start.

### Checklist
- [ ] `prisma/migrations/` folder exists and is committed
- [ ] `Dockerfile` uses `migrate deploy` not `db push`
- [ ] `npx prisma migrate status` shows "Database schema is up to date"

---

## Task 3 — Nonce-based Content Security Policy

**Impact**: Security +1.0 (eliminates `'unsafe-inline'` for scripts)  
**Effort**: ~1 h  
**Why**: `'unsafe-inline'` in `script-src` defeats XSS protection. A per-request nonce scopes script execution to only tags that React Router injects — external injected scripts are blocked.

### How it works

Every response gets a unique random nonce. React Router's `<Scripts />` component receives it and stamps each `<script>` tag with `nonce="…"`. The CSP header lists the same nonce value. Browsers only execute scripts that carry the matching nonce.

### Steps

**Step 1** — Generate the nonce in `entry.server.tsx`:

```typescript
import { randomBytes } from "node:crypto";

// Inside handleRequest, before renderToPipeableStream:
const nonce = randomBytes(16).toString("base64");
```

**Step 2** — Pass the nonce to `renderToPipeableStream`:

```typescript
const { pipe, abort } = renderToPipeableStream(
  <ServerRouter context={routerContext} url={request.url} nonce={nonce} />,
  { ... }
);
```

**Step 3** — Update the CSP header (replace `'unsafe-inline'` with the nonce):

```typescript
responseHeaders.set(
  "Content-Security-Policy",
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    `img-src 'self' data: https://api.qrserver.com ${env.R2_PUBLIC_URL}`,
    `frame-src 'self' ${env.R2_PUBLIC_URL}`,
    "connect-src 'self' ws: wss:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
);
```

**Step 4** — Pass the nonce through React Router's `AppLoadContext` so `root.tsx` can reach it (React Router v7 supports this via the `nonce` prop on `<Scripts />`):

In `root.tsx`, the `<Scripts />` component already accepts a `nonce` prop. React Router v7 framework mode passes the nonce automatically when you set it on `<ServerRouter>`. Verify by checking that rendered HTML shows `<script nonce="…">`.

**Step 5** — Test with browser DevTools:
- Open Console → look for CSP violations. There should be none.
- Attempt to inject `<script>alert(1)</script>` in a text field — browser should block it.

### Checklist
- [ ] Nonce generated per request with `randomBytes(16).toString("base64")`
- [ ] `script-src` no longer contains `'unsafe-inline'`
- [ ] React renders with `<script nonce="…">` tags
- [ ] No CSP violations in browser console on any page
- [ ] Inline `onclick` and `eval` still blocked (verify with DevTools)

---

## Minor improvements (each +0.1–0.2)

### 4. Gitignore `build/` output

The `build/` directory is compiled output — it should never be in git.

```bash
echo "build/" >> .gitignore
git rm -r --cached build/
git commit -m "chore: stop tracking build output"
```

### 5. Add DB health to `/ready`

The current `/ready` route likely only checks that the process is alive. Add a lightweight Prisma ping:

```typescript
// In app/routes/ready.ts loader
await db.$queryRaw`SELECT 1`;
```

Return `503` if it throws. This lets your load balancer pull the instance if the DB is unreachable.

### 6. Paginate attendance history and course list

For users with many courses or a long semester of attendance, unbounded queries slow down page load.

**Attendance**: Pass a `?page=` search param to the attendance loader. Use `skip`/`take` on the `generate_series` date list (or limit the date range to the last 90 days by default with a "load more" link).

**Courses**: `db.course.findMany` with `take: 50, skip: offset`. Most users won't notice with fewer than 20 courses, but the guard prevents edge cases.

### 7. CSRF double-submit cookie (optional hardening)

`SameSite=Lax` blocks most CSRF for top-level navigations but not for same-site subdomains. If you ever host the API and frontend on different subdomains, add a CSRF double-submit token. For now, `Lax` + `HttpOnly` is acceptable.

---

## Score projection after each task

| After task | Score |
|-----------|-------|
| Current | 8.54 |
| + Task 1 (split file) | ~8.9 |
| + Task 2 (migrations) | ~9.2 |
| + Task 3 (nonce CSP) | ~9.6 |
| + Minor items 4–7 | ~9.9 |
