# Adventure Planner repository instructions

These instructions apply to the entire repository. Treat statements under **Repository facts** as descriptions of the current code. Treat statements under **Product rules** as requirements for future work, even when legacy code does not yet fully enforce them.

## Product

### Repository facts

- This is **Our Adventures**, a private, mobile-first shared planner for Jordan and Liz. Space names and membership are live Supabase data; never hard-code the current space name, users, emails, or IDs.
- Authenticated routes cover Today, Ideas, Calendar, Memories, People & Invitations, Adventure details, and completed-Adventure memory details. See `src/App.tsx`.
- Adventures include schedules, locations, covers, itineraries, notes, links, checklists, completion, weather, and memories with photos.
- Today, Ideas, and Adventure features use live Supabase-backed provider state.

### Product rules

- Preserve the personal, warm, restrained, Apple-inspired experience. This is not a generic admin dashboard.
- Existing Supabase records and storage objects are production-like data and must be protected.

## Repository map

- `src/App.tsx`: route tree and protected-application provider composition.
- `src/pages.tsx`, `src/memory-detail.tsx`, `src/members.tsx`: route-level UI. `src/components.tsx` contains shared shell and primitives such as `Sheet`, `SafeImage`, and headers.
- `src/auth.tsx`, `src/workspace.tsx`, `src/ideas.tsx`, `src/context.tsx`: auth, active-space, Ideas, and Adventure state/orchestration.
- `src/repositories/`: Supabase persistence and database-to-domain mapping. Add data access here instead of calling Supabase from rendering components.
- `src/types.ts`: shared UI/domain types. Database row shapes are currently local to repositories; no generated database type file exists.
- `src/calendar.ts`, `src/itinerary.ts`, `src/idea-model.ts`, `src/category-visuals.ts`: shared domain normalization and formatting.
- `src/styles.css`: global tokens, responsive layout, focus styles, and component CSS. `public/category-art/README.md` documents replace-in-place artwork contracts.
- `supabase/migrations/`: ordered schema, constraints, RLS, RPC, trigger, storage, and cache migrations. `supabase/seed.sql` is intentionally non-destructive and contains no users or production data.
- `supabase/functions/`: authenticated Edge Functions for invitations, geocoding, and weather.
- `artwork-source/`: source artwork; `public/category-art/` contains optimized runtime assets.
- `README.md`: local setup, Auth URL configuration, database linking, and invitation delivery notes.
- Root `vercel.json` provides the Vercel SPA fallback for client-side routes. There is no Supabase `config.toml`, CI workflow, generated database types, or automated E2E configuration.

## Development commands

Use the npm lockfile. Do not substitute another package manager.

```bash
npm ci                 # clean dependency install
npm run dev            # Vite development server
npm run typecheck      # tsc -b --pretty false
npm run lint           # ESLint
npm run build          # TypeScript project build plus Vite production build
```

There is no `npm test` script. Do not claim automated tests ran. If a task justifies adding a test runner, add its script/configuration and document it rather than using an ad hoc hidden convention.

Supabase CLI workflow, after confirming the intended project:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase migration new <descriptive_name>
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db push --linked
npx supabase functions deploy <function-name>
```

- Never put project refs, credentials, or production IDs in this file or source code.
- Browser/E2E tooling is not configured in the repository. For UI work, run the dev server and use the available browser tooling; do not invent a repository test command.

## Environment and deployment

- Browser configuration is limited to `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; copy `.env.example` to an ignored `.env.local`.
- Every `VITE_` value is public browser-bundle data. Never place secret/service-role keys, database passwords, Brevo credentials, or access tokens there.
- Edge Functions use Supabase-provided server environment variables. Invitation delivery additionally needs `BREVO_API_KEY` and `INVITATION_FROM_EMAIL`; see `README.md`.
- Vercel routing is committed only through the root SPA fallback. Project identity, domains, environment variables, and deployment steps remain external configuration and must be confirmed separately.

## Working method

- Inspect relevant code, migrations, and current git state before editing. For complex or cross-cutting changes, write a plan first.
- Make the smallest coherent change. Preserve existing behavior unless the request explicitly changes it; do not silently broaden scope.
- Reuse existing components, domain helpers, providers, repositories, RPCs, and design tokens. Explain why the current stack is insufficient before adding a dependency.
- State assumptions and unresolved decisions. Update `README.md` or these instructions when commands, architecture, environment, or durable behavior changes.
- Preserve unrelated user changes in a dirty worktree. Do not reformat large legacy files as incidental work.

## Architecture

- The frontend is React + TypeScript + Vite with `BrowserRouter`. `AuthProvider` wraps routing; protected routes then use `WorkspaceProvider`, `AdventureProvider`, and `IdeasProvider`.
- `src/lib/supabase.ts` creates the single browser Supabase client. Rendering components consume contexts; contexts coordinate workflows; repositories perform persistence and map snake_case rows into domain types.
- Keep rendering, persistence, and external-provider code separate. Provider payloads must be normalized at repository/Edge Function boundaries before reaching UI.
- Edge Functions must authenticate the caller and authorize through caller-scoped RLS or an explicit membership/owner check. Never accept client-supplied coordinates or ownership claims when the authoritative record can be loaded by ID.
- Server-only cache/secrets may use service credentials only inside Edge Functions. Never expose them to the browser.

## TypeScript and React

- `tsconfig.app.json` is strict. Preserve strict types; avoid `any`. If an unavoidable boundary needs an assertion, validate the unknown data first and keep the assertion local.
- Reuse domain types from `src/types.ts` and normalization helpers rather than creating parallel models.
- Keep hooks unconditional, include all reactive dependencies, and clean up timers, subscriptions, and aborted requests.
- Avoid duplicating server state in multiple components or forcing remounts with unstable keys. Keep transient UI state close to its consumer.
- Preserve semantic controls, accessible names, keyboard behavior, Escape handling, focus restoration, and dialog/popover semantics already used by shared components.

## Database and Supabase

- Every schema, policy, grant, function, trigger, bucket, or constraint change requires a new file created with `npx supabase migration new <name>`. Never rewrite an applied migration.
- Prefer additive, backward-compatible migrations. Preserve all existing rows. Destructive migrations or production-data transformations require explicit approval and a separate impact/rollback plan.
- Use constraints for durable invariants. Review foreign-key `on delete` behavior before changing delete, duplicate, membership, invitation, memory, or storage flows.
- RLS is the authorization boundary. Never disable or weaken it to fix a client error, and never rely on UI visibility as authorization.
- Planning tables are scoped by membership. Use the existing `private.is_space_member`, `private.is_space_owner`, `private.shares_space_with`, and Adventure helper pattern; do not directly recurse through `space_members` from its own policies.
- Existing privileged helpers use an empty `search_path`, schema-qualified objects, explicit `auth.uid()`/membership checks, and revoked public/anon execution. Follow all of those conventions for any justified `security definer` function.
- Membership mutations and invitations are RPC-only. Do not restore direct authenticated insert/delete grants on `space_members` or writes to `space_invitations`.
- The weather cache is server-only: authenticated/anon access is revoked and the service role owns cache writes. Schedule/location changes invalidate its Adventure row.
- No generated database types or generation script currently exists. If introducing generated types, establish and document one reproducible command and commit the generated output with the schema change.
- Never run `db reset`, reseed, truncate, or bulk-delete against the linked project. Always review `db push --linked --dry-run`, migration history, row counts, and expected-role reads/writes.

## Authentication and permissions

- Authentication uses Supabase passwordless email magic links. Redirect origins come from `window.location.origin`; do not add hard-coded development or production hosts.
- Roles are `owner` and `member`. Both can work with Ideas, Adventures, stops, checklist items, links, and completed memories in their spaces.
- Owners additionally rename spaces, create/revoke invitations, remove non-owner members, and can delete any member's Adventure photo. Uploaders can delete their own photos.
- Invitation roles are currently member-only. Owner removal/transfer is intentionally unsupported, and an owner cannot remove themself through the existing RPC.
- Completed-Adventure membership is required for memory/photo access. The `adventure-photos` bucket is private, limited to JPEG/PNG/WebP files up to 10 MiB, and uses `spaces/<space-id>/adventures/<adventure-id>/...` paths.
- Never add email whitelists, hard-coded users, client-trusted roles, or browser-exposed admin credentials. Test the relevant member, owner, non-member, and unauthenticated paths when permissions change.

## Production-data safety

- Treat linked Supabase data and storage as production. Prefer local, mocked, or isolated verification.
- Do not manually edit records unless the task explicitly requires a targeted repair. Guard any approved repair with identifying preconditions, change only scoped fields, verify before/after values, and report it separately from code changes.
- Do not reset, reseed, truncate, clear caches globally, delete storage objects, or create test records in the linked project without explicit authorization. Clear only a specifically identified cache/test row when required.
- Before delete, duplicate, invitation, membership, or storage changes, inspect RLS, grants, triggers, RPC checks, and cascades.

## Geographic data

Mandatory product rule for new or changed geographic work: the current automatic single-result geocoder is legacy behavior and is **not** a precedent.

- Never silently choose a place from ambiguous text or fabricate coordinates. Store coordinates only after an explicit selected candidate, explicit pin placement, or another clearly confirmed source.
- Preserve the user's location label separately from normalized provider data. Return multiple candidates when ambiguous; do not progressively strip city, region, or country as an automatic fallback.
- Keep place search, geocoding, map rendering, weather, and routing as separate concerns. Text-only locations remain valid.
- Validate latitude/longitude as a complete pair and within database bounds. Preserve the saved timezone. Do not repeatedly geocode an already confirmed place.
- Weather requests load coordinates from the authorized Adventure record, normalize provider states, select the nearest scheduled hour, and keep external failures non-blocking.

## Dates, times, and ordering

- Database dates are `YYYY-MM-DD`; times are nullable SQL `time` values. UI helpers intentionally parse local dates without UTC day shifts and accept 12- or 24-hour clock strings.
- Preserve missing/TBC times. Reuse `formatAdventureDateTimeRange`; never render dangling separators or a range with a missing endpoint.
- New timed stops are inserted chronologically before untimed stops; untimed stops remain stable at the end. Persist order through the reorder RPCs and their deferrable unique constraints.
- Do not optimize, route, or reorder a user-created itinerary without an explicit user action. Manual reorder must remain deterministic.

## UI, responsive behavior, and accessibility

- Reuse the CSS tokens in `:root` (`--bg`, `--surface`, `--coral`, `--sage`, `--blue`, `--lav`, `--gold`, text, border, divider, and shadow tokens) and existing shared components. Avoid arbitrary colors and generic dashboard cards.
- Maintain calm hierarchy, current gutters/radii/control sizing, local category artwork contracts, and the itinerary marker system. Non-final markers cycle through `ITINERARY_STOP_COLORS`; the final stop remains purple (`FINAL_STOP_COLOR`).
- Mobile uses a safe-area-aware fixed bottom navigation. At the `900px` desktop breakpoint, the document is locked and internal surfaces own scrolling: `main` is hidden-overflow, Ideas scrolls in `.idea-list`, and detail routes scroll in `.detail-main`. Do not restore document-level desktop scrolling.
- Verify at least one desktop viewport at or above 900px and a narrow 320–390px mobile viewport. Check safe areas, bottom navigation, clipping, overflow, wrapping, focus, overlays, and one real interaction. Do not fix one viewport by regressing the other.
- Use semantic buttons/links, visible focus, accessible names, and non-color state indicators. Dialogs, sheets, menus, lightboxes, and popovers must support keyboard use, Escape where appropriate, and focus restoration. Informative images need meaningful alternatives; decorative images use empty alt text.
- Respect `prefers-reduced-motion`; do not add unavoidable motion.

## Errors and external services

- Give async UI intentional loading, empty, partial, recoverable, and failure states. External-service failure must not break unrelated planning features.
- Preserve meaningful normalized states such as missing input, too early, invalid timezone, provider unavailable, and no hourly match; do not collapse recoverable failures into a generic unavailable state.
- Log actionable stage/status information in development or server logs without JWTs, tokens, secrets, raw credentials, or excessive personal data. User-facing errors must remain concise and safe.

## Verification and definition of done

For every code change, run:

```bash
npm run typecheck
npm run lint
npm run build
git diff --check
```

- For behavior changes, add/update targeted tests when a repository test harness exists. Until one exists, perform focused browser verification and explicitly report the automated-test gap.
- For user-facing work, test desktop and mobile plus relevant loading, empty, error, permission, and retry states. Inspect screenshots for visual work and check the browser console/framework overlays.
- For migrations, dry-run first; verify migration history, constraints, preserved row counts, and expected authenticated/unauthenticated/owner/member behavior. Never use `db reset`.
- A task is done only when requested behavior works, unrelated behavior is preserved, types/schema remain synchronized, authorization is enforced at the server/database boundary, relevant checks and production build pass, responsive/accessibility behavior is checked, and migrations/environment/manual steps are documented.
- Report changed files, deployed or manual actions, checks actually run, and anything that could not be verified. Never claim verification that was not performed.

## Do not

- Do not weaken/bypass RLS or expose service secrets to the browser.
- Do not add hard-coded emails, users, IDs, space names, project refs, or credentials.
- Do not fabricate or silently guess geographic coordinates.
- Do not destroy, reset, reseed, or casually mutate existing data/storage.
- Do not replace established design patterns with generic components.
- Do not add routing, mapping, optimization, dependencies, or broad refactors as incidental scope.
- Do not claim tests, browser checks, deployments, or data verification that did not happen.
