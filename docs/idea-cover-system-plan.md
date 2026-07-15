# Saved Ideas Cover System

## Summary

The Saved Ideas artwork system uses stable, curated photo presets while the eight existing category filter tiles retain their glyph artwork. Phase 1 delivered the preset foundation and card thumbnails. Phase 2 adapts the existing Adventure cover picker for explicit Idea preset selection. Phase 3 remains deferred for uploaded and generated sources.

Current architecture:

- The eight filters are All, Date Night, and the six canonical categories in `src/idea-model.ts`. Date Night is an `is_date_night` flag, not a cover category.
- Idea writes flow through `IdeasProvider` and `src/repositories/ideas.ts`; no RPC, Edge Function, duplicate, import, or seed path creates Ideas.
- `ideas.image_url` maps to `optionalImage` and remains part of Idea-to-Adventure promotion. It will not be repurposed.
- Eighteen local editorial covers already exist under `public/category-art/covers`, and the generic Adventure cover is suitable as the safe general fallback.
- Ideas remain protected by existing membership RLS. No policy change is required.

## Phase 1 — Complete

### Data model

- Add nullable `public.ideas.cover_preset_id text` in an additive migration.
- Add only a non-empty-when-present constraint. Do not enumerate registry values in SQL, backfill rows, or alter policies, grants, triggers, functions, or storage.
- Add optional `coverPresetId` to the Idea domain model and map `cover_preset_id` through all repository selects.
- Generate new Idea UUIDs in the client repository with `crypto.randomUUID()`, resolve a recognized supplied or automatic preset, and insert the ID and preset atomically.
- Preserve recognized persisted presets on edits. Existing null values remain null during ordinary edits and derive a stable display fallback at render time.
- Leave `image_url` and promotion behavior unchanged.

### Preset registry and assets

Create a typed registry in `src/idea-covers.ts` with stable IDs independent of paths:

- Food & Drink: `food-dinner`, `food-cafe`, `food-garden`
- Music & Events: `music-jazz-stage`, `music-outdoor-stage`, `music-theatre`
- Outdoors: `outdoors-forest-trail`, `outdoors-canoe-lake`, `outdoors-coast`
- Culture: `culture-estate`, `culture-sculpture`, `culture-gallery`
- At Home: `home-cozy-night`, `home-journal`, `home-cooking`
- Trips & Getaways: `trip-countryside`, `trip-lake-cabin`, `trip-old-town`
- General: `general-default`

The curated category libraries now contain `/category-art/covers/<category>/01.webp` through `09.webp`; the general preset remains `/category-art/generic/adventure-cover.webp`. Stable Idea IDs are independent from filenames, and the expanded inventory is documented in `public/category-art/README.md`. Keep category glyph exports unchanged.

Resolution order:

1. A recognized persisted preset wins.
2. The canonical category is authoritative.
3. Simple normalized title/description keywords refine the variant within that category.
4. Otherwise hash the Idea ID and choose deterministically within the category.
5. Unknown categories may use recognized keyword groups, then fall back to `general-default`.
6. Invalid or retired preset IDs use the same automatic fallback.

Date Night may bias Food toward dinner or At Home toward cozy-night but never becomes a category. Keyword rules remain small, explicit, and local; no AI or external service is involved.

### UI and accessibility

- Add one reusable `IdeaCoverThumbnail` using the resolver and `SafeImage`.
- Use it in the Saved Ideas list at 64×64 and Today recent Ideas at 58×58.
- Reserve dimensions, use rounded overflow and `object-fit: cover`, lazy-load, and use empty alt text because the adjacent Idea title conveys identity.
- Fall back to `general-default`; if both images fail, preserve the reserved space without a broken-image icon.
- Preserve card density, text, statuses, attribution, actions, navigation, filtering, search, scheduling, deletion, and promotion.
- Do not change the eight category filter tiles or their glyph artwork.

### Migration and rollout

- Existing Ideas are not rewritten. Null records resolve a deterministic cover from category, keywords, and Idea ID.
- Deploy the database migration before a future frontend deployment because repository selects will reference the new column.
- Old clients ignore the additive column. New clients validate registry IDs and safely handle unknown values.
- The additive Phase 1 migration has already been committed and applied. Phase 2 requires no schema, RLS, storage, or provider changes.

## Phase 2 — Implement now

Adventures already have a responsive `CoverPhotoSheet` with current preview, Automatic, three category covers, custom URL validation, Save, and Cancel. Phase 2 extracts only its presentation into a shared cover-picker sheet and keeps two small consumer wrappers:

- Shared presentation owns the sheet/form structure, preview, Automatic row, supplied preset grid, selected/check state, error placement, sticky Save/Cancel actions, and existing responsive styles.
- The Adventure wrapper retains its current stable-category variants, custom URL state and validation, `AdventureCoverSelection` payload, copy, and persistence behavior unchanged.
- The Idea wrapper supplies the current canonical category's preset registry entries and persists only `cover_preset_id` through the existing Idea save/update path. It has no custom URL section.

Interaction and persistence:

- Add one “Change cover” action inside the existing edit-only Idea sheet. New unsaved Ideas continue receiving their Phase 1 automatic assignment on creation.
- Opening shows the effective current preview, Automatic, and the current category's nine presets in a bounded desktop grid or compact mobile carousel. If an explicit preset belongs to another category, include that current preset as an additional selected choice rather than silently replacing it.
- Saving a preset persists its stable ID immediately and updates the local edit draft. Automatic explicitly persists `NULL`, returning the Idea to deterministic category/keyword/ID resolution across reloads.
- Cancel and Escape close only the picker and do not call persistence. Shared `Sheet` behavior provides dialog semantics, initial focus, Escape isolation, and focus restoration.
- Category edits preserve an explicit preset. The picker offers the new category's presets while retaining the cross-category current selection until the user chooses Automatic or a replacement.
- Invalid or retired IDs render through the existing resolver. The picker treats Automatic as the repair choice, and saving it clears the invalid value.

Custom image URL support is intentionally deferred for Ideas. Adventure custom URLs remain unchanged, and `ideas.image_url` is not repurposed. The shared component accepts consumer-specific content so a future source model can add Idea custom controls without changing its preset API.

Tests cover shared presentation, Adventure regression and custom URL parity, Idea entry and persistence, Automatic clearing, Cancel and Escape, reload/re-render state, cross-category preservation, invalid-ID repair, and existing Ideas/Today/filter/promotion behavior.

## Phase 3 — Plan only

- Add a constrained `cover_source` representation for `preset`, `uploaded`, and `generated`, plus a private storage object path.
- Resolve a valid uploaded/generated object before the persisted preset, then use the deterministic preset fallback.
- Use membership-scoped private storage paths and signed reads. Validate JPEG, PNG, and WebP files, set explicit size limits, and provide responsive crop previews.
- Define replacement/deletion cleanup and audit legacy `image_url` values before any migration.
- Generated covers require explicit user action, moderation, provenance, quotas, safe prompt handling, and recoverable retry states.

## Testing and validation

Phase 1 tests cover registry completeness and unique IDs, local asset existence, deterministic assignment, keywords, persisted precedence, invalid and unknown fallbacks, atomic create payloads, edit preservation, null compatibility, shared rendering, decorative accessibility, image failure fallback, unchanged category filters, migration scope, and existing Ideas/Today workflows.

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Browser automation is intentionally excluded. Manual review should cover desktop and narrow-mobile cropping, focal points, density, overflow, and missing-image resilience. Food & Drink and Outdoors are production-ready photography; Music & Events, Culture, At Home, Trips & Getaways, and the general fallback remain replace-in-place artwork requiring visual approval. Legacy null Ideas continue resolving against the original three-ID pool, while creation may resolve against all nine and persists the result. Adventure automatic assignment likewise remains on filename slots 01–03; explicit 04–09 choices use the existing image-path representation.
