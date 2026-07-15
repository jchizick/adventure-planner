# Category artwork

These local WebP assets provide category glyphs, Saved Idea covers, and Adventure covers. The eight category filter tiles continue to use the separate files under `ideas/`; cover-library work must not replace those glyphs.

## Cover contracts

- Recommended cover format: WebP, 1600×800 (2:1), with the focal subject safe inside a centered crop.
- Files 01–03 are the original Adventure variant slots. Their filenames and order are a persistence contract and must not change.
- Files 04–09 expand the explicit Idea and Adventure pickers. Adventure automatic assignment intentionally remains limited to 01–03.
- Saved Ideas persist stable preset IDs, not filenames. Never rename an existing ID. Replacing an image in place keeps database rows valid.
- New files need a descriptive label in `CATEGORY_COVER_ASSETS`, a globally unique stable Idea ID in `IDEA_COVER_PRESETS`, keyword coverage where useful, and registry/picker tests.
- Do not add remote image dependencies. Optimize locally and check crop quality at desktop and narrow-mobile widths.

Culture 04–09 are 1774×887 rather than the recommended 1600×800. They retain the required 2:1 ratio and are accepted as supplied; future replace-in-place revisions should normalize them to 1600×800.

## Expanded inventory

`Existing` means the filename was already part of the original three-slot library. Food & Drink and Music & Events 01–03 were manually replaced in place during this expansion; their persisted filename contract remains unchanged. No files are byte-identical. Some intentionally overlap in theme (for example quiet cafes, dinners, sculpture gardens, cabins, and concerts) but provide different compositions.

### At Home

| File | Dimensions | Bytes | Status | Stable Idea preset ID |
| --- | ---: | ---: | --- | --- |
| 01.webp | 1600×800 | 47,608 | Existing | `home-cozy-night` |
| 02.webp | 1600×800 | 63,348 | Existing | `home-journal` |
| 03.webp | 1600×800 | 41,270 | Existing | `home-cooking` |
| 04.webp | 1600×800 | 112,060 | New | `home-yoga-meditation` |
| 05.webp | 1600×800 | 185,376 | New | `home-movie-night` |
| 06.webp | 1600×800 | 164,006 | New | `home-board-games` |
| 07.webp | 1600×800 | 150,682 | New | `home-reading-nook` |
| 08.webp | 1600×800 | 139,934 | New | `home-baking` |
| 09.webp | 1600×800 | 126,398 | New | `home-creative-studio` |

### Culture

| File | Dimensions | Bytes | Status | Stable Idea preset ID |
| --- | ---: | ---: | --- | --- |
| 01.webp | 1600×800 | 153,098 | Existing | `culture-estate` |
| 02.webp | 1600×800 | 107,056 | Existing | `culture-sculpture` |
| 03.webp | 1600×800 | 63,160 | Existing | `culture-gallery` |
| 04.webp | 1774×887 | 450,018 | New | `culture-historic-library` |
| 05.webp | 1774×887 | 461,938 | New | `culture-classical-courtyard` |
| 06.webp | 1774×887 | 292,766 | New | `culture-pottery-studio` |
| 07.webp | 1774×887 | 228,320 | New | `culture-coastal-sculpture-garden` |
| 08.webp | 1774×887 | 182,750 | New | `culture-modern-gallery` |
| 09.webp | 1774×887 | 300,678 | New | `culture-arts-district` |

### Food & Drink

| File | Dimensions | Bytes | Status | Stable Idea preset ID |
| --- | ---: | ---: | --- | --- |
| 01.webp | 1600×800 | 144,780 | Existing, replaced | `food-sunny-brunch` |
| 02.webp | 1600×800 | 82,008 | Existing, replaced | `food-dinner` |
| 03.webp | 1600×800 | 110,120 | Existing, replaced | `food-cafe` |
| 04.webp | 1600×800 | 114,310 | New | `food-waterfront-market` |
| 05.webp | 1600×800 | 199,888 | New | `food-sushi-bar` |
| 06.webp | 1600×800 | 189,374 | New | `food-vineyard-picnic` |
| 07.webp | 1600×800 | 97,458 | New | `food-candlelit-dinner` |
| 08.webp | 1600×800 | 77,002 | New | `food-window-cafe` |
| 09.webp | 1600×800 | 138,454 | New | `food-garden` |

### Music & Events

| File | Dimensions | Bytes | Status | Stable Idea preset ID |
| --- | ---: | ---: | --- | --- |
| 01.webp | 1600×800 | 161,162 | Existing, replaced | `music-outdoor-stage` |
| 02.webp | 1600×800 | 83,412 | Existing, replaced | `music-dance-night` |
| 03.webp | 1600×800 | 113,136 | Existing, replaced | `music-acoustic-cafe` |
| 04.webp | 1600×800 | 134,426 | New | `music-classical-hall` |
| 05.webp | 1600×800 | 230,336 | New | `music-day-festival` |
| 06.webp | 1600×800 | 111,998 | New | `music-neon-concert` |
| 07.webp | 1600×800 | 117,382 | New | `music-community-concert` |
| 08.webp | 1600×800 | 58,708 | New | `music-theatre` |
| 09.webp | 1600×800 | 65,694 | New | `music-jazz-stage` |

### Outdoors

| File | Dimensions | Bytes | Status | Stable Idea preset ID |
| --- | ---: | ---: | --- | --- |
| 01.webp | 1600×800 | 257,414 | Existing | `outdoors-forest-trail` |
| 02.webp | 1600×800 | 181,094 | Existing | `outdoors-canoe-lake` |
| 03.webp | 1600×800 | 250,606 | Existing | `outdoors-coast` |
| 04.webp | 1600×800 | 395,126 | New | `outdoors-lakeside-campsite` |
| 05.webp | 1600×800 | 381,084 | New | `outdoors-meadow-picnic` |
| 06.webp | 1600×800 | 500,624 | New | `outdoors-mountain-trail` |
| 07.webp | 1600×800 | 517,146 | New | `outdoors-waterfall-boardwalk` |
| 08.webp | 1600×800 | 375,370 | New | `outdoors-coastal-hike` |
| 09.webp | 1600×800 | 240,600 | New | `outdoors-canoe-sunrise` |

### Trips & Getaways

| File | Dimensions | Bytes | Status | Stable Idea preset ID |
| --- | ---: | ---: | --- | --- |
| 01.webp | 1600×800 | 147,336 | Existing | `trip-countryside` |
| 02.webp | 1600×800 | 141,750 | Existing | `trip-lake-cabin` |
| 03.webp | 1600×800 | 182,266 | Existing | `trip-old-town` |
| 04.webp | 1600×800 | 178,090 | New | `trip-coastal-road-trip` |
| 05.webp | 1600×800 | 249,944 | New | `trip-mediterranean-harbour` |
| 06.webp | 1600×800 | 312,116 | New | `trip-old-town-sunset` |
| 07.webp | 1600×800 | 235,194 | New | `trip-mountain-lodge` |
| 08.webp | 1600×800 | 182,004 | New | `trip-lakeside-cabin` |
| 09.webp | 1600×800 | 177,472 | New | `trip-scenic-train` |

The general Saved Idea fallback remains `general-default`, using `generic/adventure-cover.webp`.

## Idea and Adventure behavior

Ideas and Adventures share local image paths but deliberately keep separate persistence models. Ideas store stable preset IDs. Existing recognized IDs always win; legacy null Ideas retain the original three-ID deterministic fallback, while newly created Ideas may resolve against all nine category presets and persist the result atomically.

Adventures keep `cover_variant` values 1–3 for the original filename slots. Explicit selections from 04–09 use the existing `coverImage` path. Automatic Adventure covers continue to hash over 01–03 only, so expanding the library does not rotate existing Adventures. Custom URL support remains independent and unchanged.

The current direction is warm, editorial destination and activity photography with restrained color and clear center-safe subjects. Food & Drink and Outdoors retain their production-ready designation. The other category sets and the general fallback remain subject to manual visual approval; refresh them by replacing assets in place and retaining stable IDs and filename contracts.
