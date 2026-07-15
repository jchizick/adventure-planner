# Saved Ideas Cover System

## Summary

The Saved Ideas artwork system will use stable, curated photo presets while the eight existing category filter tiles retain their glyph artwork. Phase 1 adds the preset foundation and card thumbnails. Phase 2 adds a preset picker. Phase 3 adds uploaded and generated sources.

Current architecture:

- The eight filters are All, Date Night, and the six canonical categories in `src/idea-model.ts`. Date Night is an `is_date_night` flag, not a cover category.
- Idea writes flow through `IdeasProvider` and `src/repositories/ideas.ts`; no RPC, Edge Function, duplicate, import, or seed path creates Ideas.
- `ideas.image_url` maps to `optionalImage` and remains part of Idea-to-Adventure promotion. It will not be repurposed.
- Eighteen local editorial covers already exist under `public/category-art/covers`, and the generic Adventure cover is suitable as the safe general fallback.
- Ideas remain protected by existing membership RLS. No policy change is required.

## Phase 1 — Implement now

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

Map category presets to the existing `/category-art/covers/<category>/01.webp` through `03.webp` files and the general preset to `/category-art/generic/adventure-cover.webp`. Keep category glyph exports unchanged.

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
- Do not push the Phase 1 migration, deploy, or commit as part of this implementation task.

## Phase 2 — Plan only

- Add “Change cover” inside the existing Idea edit sheet.
- Use an accessible responsive radio grid, showing the current category first and allowing optional browsing of other categories.
- Persist the selected preset through the existing save flow; Cancel changes nothing.
- Preserve any persisted cover when category changes, including an automatically assigned preset. Users explicitly choose a replacement when desired.
- Include visible selection, keyboard navigation, Escape handling, focus restoration, and tests for save, cancel, category changes, cross-category selection, and retired IDs.

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

Browser automation is intentionally excluded. Manual review should cover desktop and narrow-mobile cropping, focal points, density, overflow, and missing-image resilience. Food & Drink and Outdoors are production-ready photography; Music & Events, Culture, At Home, Trips & Getaways, and the general fallback remain replace-in-place starter artwork requiring visual approval.
