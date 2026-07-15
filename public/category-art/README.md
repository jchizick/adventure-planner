# Category artwork

These files are local, optimized artwork for the centralized category visual system.

- Idea illustrations are 256×256 WebP files.
- Adventure covers are 1600×800 WebP files.
- Food & Drink and Outdoors are final photography sets.
- The remaining category covers currently derive from the app's original local Adventure cover with category-specific colour treatments and crops.

Final artwork can replace any file in place. Keep the existing filenames and dimensions so no application code or database records need to change.

## Saved Idea cover presets

Saved Idea cards reuse the existing 1600×800 cover files through stable preset IDs. The IDs are stored independently from asset paths so artwork can be replaced without rewriting Idea rows.

- Food & Drink: `food-dinner`, `food-cafe`, `food-garden`
- Music & Events: `music-jazz-stage`, `music-outdoor-stage`, `music-theatre`
- Outdoors: `outdoors-forest-trail`, `outdoors-canoe-lake`, `outdoors-coast`
- Culture: `culture-estate`, `culture-sculpture`, `culture-gallery`
- At Home: `home-cozy-night`, `home-journal`, `home-cooking`
- Trips & Getaways: `trip-countryside`, `trip-lake-cabin`, `trip-old-town`
- General fallback: `general-default`, using `generic/adventure-cover.webp`

Food & Drink and Outdoors are production-ready photography. Music & Events, Culture, At Home, Trips & Getaways, and the general fallback are starter artwork pending manual visual approval. Replace files in place at their existing dimensions and filenames; do not rename preset IDs when refreshing artwork.
