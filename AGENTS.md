# Project Guide

## Overview

Hallways is a browser-based 3D blog built with A-Frame 1.8 and native JavaScript ES modules. It supports Markdown posts from `content/posts/` and WordPress.com REST API content. The app has no package manifest, bundler, or automated test suite.

## Run Locally

Serve the repository root over HTTP; do not open `index.html` directly:

```bash
python3 -m http.server 8000
```

Set `content/config.json` to `"contentSource": "wordpress"` to enable WordPress. In a second terminal, start the image proxy:

```bash
node server-proxy.js
```

The proxy listens on port 3000 by default. Keep `WORDPRESS_IMAGE_PROXY_URL` in `.env` aligned with its port. The browser fetches `.env`, so all values in it are public configuration; never put credentials or secrets there. `WORDPRESS_IMAGE_ALLOWED_HOSTS` restricts HTTPS image proxy targets.

## Content

- Markdown mode reads the filename list in `content/posts/index.json`; each file uses front matter and Markdown body text.
- WordPress mode reads `WORDPRESS_API_BASE_URL`, optionally filters categories with `WORDPRESS_PARENT_CATEGORY_ID`, then fetches posts per category.
- `src/content-parser.js` normalizes both sources to the shared post/category data model.
- WordPress post HTML is parsed into canvas text and image blocks. Image planes and the article canvas use the configured local CORS proxy.

## Architecture

| File | Responsibility |
|------|----------------|
| `main.js` | Startup, source selection, and lobby/post transitions |
| `src/content-parser.js` | Markdown parsing, `.env` parsing, and WordPress API requests |
| `src/navigation.js` | Movement, doorway crossings, wall collisions, and destination readiness |
| `src/hallway-loader.js` | Streaming GLTF corridor segment lifecycle |
| `src/room-generator.js` | Polygon lobbies, category lobbies, reading rooms, and image panels |
| `src/post-canvas.js` | Article canvas layout, image loading, and scrolling |
| `src/post-scrollbar.js` | A-Frame scrollbar component |
| `server-proxy.js` | WordPress passthrough and allowlisted CORS image proxy |
| `index.html` | A-Frame scene, rig, containers, assets, and module entry point |

## Navigation Invariants

- Normal corridors are fixed at 20m and use two 10m GLTF segments. Post rooms and category lobbies start at the corridor endpoint; do not derive their position from how far the player moved while content loaded.
- Return corridors may use a doorway-specific endpoint so they meet the previous lobby entrance exactly.
- Keep `destinationReady` false until destination A-Frame entities have emitted `loaded` and had render frames. While false, navigation must hold the player just before the destination rather than hide the corridor or enter an empty space.
- Keep lobby boundary coordinates, doorway normals/tangents, and hallway transforms in the same world-space coordinate system.
- Post reading rooms are 16m wide and 12m deep, with a height that grows to fit image panels. Preserve image aspect ratios and include failed-image fallbacks.

## Editing and Verification

Use the existing browser-side ES module and A-Frame patterns; avoid adding dependencies or build tooling unless the project scope changes. Keep category/post routing and destination readiness coordinated between `main.js`, `navigation.js`, `hallway-loader.js`, and `room-generator.js`.

There are no configured test scripts. After JavaScript changes, check editor diagnostics and run:

```bash
node --check server-proxy.js
git diff --check
```

For movement, collision, corridor alignment, image texture, or loading changes, verify the affected flow in a browser with WordPress mode enabled. WordPress image tests require both the static server and `node server-proxy.js`.
