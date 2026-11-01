# 3D Blog

A blog you can walk through, built with A-Frame.

## Features

- **Dynamic lobbies**: Polygon lobbies provide direct post doors for Markdown or category doors for WordPress
- **Walk-through navigation**: WASD or arrow keys move through doors; mouse movement looks around
- **Streaming hallways**: GLTF hallway segments extend ahead while post content and images load
- **Reading rooms**: Each post ends in a cubical room with a scrollable, canvas-textured article plane
- **Image loading**: WordPress images use an allowlisted CORS proxy so they render on both article and floating image planes

## Quick Start

### Start a local server

Due to ES modules and cross-origin restrictions, you need a local server:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

When `contentSource` is `"wordpress"`, run the image proxy in a second terminal:

```bash
node server-proxy.js
```

### Open in browser

Navigate to `http://localhost:8000`

## Controls

| Action | Desktop | VR |
|--------|---------|-----|
| Action | Desktop |
|--------|---------|
| Move | WASD or arrow keys; hold Shift to move faster |
| Look | Mouse movement |
| Read | Mouse wheel or Page Up/Page Down in a post room |
| Return | Walk back through the hallway, click Back, or press Esc |

## Project Structure

```
/hallways
├── index.html              - Entry point, A-Frame scene
├── main.js                 - App initialization
├── styles.css              - UI styling
├── .env                    - Public WordPress API settings
├── server-proxy.js         - WordPress API and CORS image proxy
│
├── content/
│   ├── config.json         - App settings, including the content source
│   └── posts/
│       ├── index.json      - Static list of Markdown posts
│       └── *.md            - Markdown blog posts
│
├── src/
│   ├── content-parser.js   - Parse markdown to posts
│   ├── room-generator.js   - Create 3D rooms
│   ├── hallway-loader.js   - Loading hallway extension
│   ├── navigation.js       - Rig movement and doorway transitions
│   └── post-canvas.js      - Draw and scroll article content
│
└── assets/
    └── models/             - GLTF models
        └── hallway_4x4x10/
```

## Adding Content

### Creating a Post

Create a `.md` file in `content/posts/`:

```markdown
---
title: "Your Post Title"
date: "2024-01-15"
category: "your-category"
excerpt: "A brief description shown in the room..."
image: "https://example.com/image.jpg"
---

Your post content here. Supports **markdown** formatting.

## Headings

- Lists
- And more

```code blocks``` too!
```

Add each Markdown filename to `content/posts/index.json` so the static app can discover it. Browsers cannot enumerate a static directory, so a new post must be listed in the manifest.

## Room Types

| Area | Behavior |
|------|----------|
| **Lobby** | Markdown has one doorway per post; WordPress has category doors that lead to category lobbies |
| **Hallway** | Repeated 4x4x10 GLTF segments extend as the reader walks forward |
| **Reading room** | A 16x8x12 room with a scrollable text plane, floating image panels, and wall/panel collision |

With no posts, the lobby displays an empty state. Images are loaded with CORS enabled; if a remote host disallows canvas use or an image fails, its placeholder is shown instead.

## Content Source

Choose the content source in `content/config.json`:

```json
{
    "contentSource": "markdown"
}
```

Set `contentSource` to `"wordpress"` to fetch public content from the WordPress.com REST API. Configure the API endpoint and optional parent category in `.env`:

```env
WORDPRESS_API_BASE_URL=https://public-api.wordpress.com/wp/v2/sites/sasori39883522.wordpress.com
WORDPRESS_PARENT_CATEGORY_ID=787237432
WORDPRESS_IMAGE_PROXY_URL=http://localhost:3000/api/image?v=2&url=
WORDPRESS_IMAGE_ALLOWED_HOSTS=*.wordpress.com,*.files.wordpress.com,images.wordpress.com,i0.wp.com,images.unsplash.com,newsdig.ismcdn.jp
```

Leave `WORDPRESS_PARENT_CATEGORY_ID` blank or omit it to load categories without a parent filter. These settings are fetched by the browser and are public; do not put credentials or secrets in `.env`. The image proxy adds the CORS headers needed for remote image textures and only fetches HTTPS URLs from `WORDPRESS_IMAGE_ALLOWED_HOSTS`. The main lobby leads to category lobbies, and each category lobby leads to its post reading rooms. WordPress requests are paginated automatically; Markdown remains the default and continues to use `content/posts/index.json`.

## Troubleshooting

### "Module not found" errors
Make sure you're running a local server, not opening the file directly.

### Hallway not appearing
Check browser console for GLTF loading errors. The model path should be correct.

### Click not working
Click the scene first to enable pointer lock, then try clicking.

## License

MIT
