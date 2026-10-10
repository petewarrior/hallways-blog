# 3D Blog

A blog you can walk through, built with A-Frame.

## Features

- **Dynamic lobby**: A polygon lobby grows with the post count and gives every post its own doorway
- **Walk-through navigation**: WASD or arrow keys move through doors; mouse movement looks around
- **Streaming hallways**: GLTF hallway segments extend ahead while post content and images load
- **Reading rooms**: Each post ends in a cubical room with a scrollable, canvas-textured article plane
- **Image fallbacks**: Cross-origin images that fail to load appear as placeholders

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
├── server-proxy.js         - WordPress proxy (optional)
│
├── content/
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
| **Lobby** | One doorway per post; at least three sides when there are one or two posts |
| **Hallway** | Repeated 4x4x10 GLTF segments extend as the reader walks forward |
| **Reading room** | A 4x4x4 room with the article drawn on a scrollable canvas plane |

With no posts, the lobby displays an empty state. Images are loaded with CORS enabled; if a remote host disallows canvas use or an image fails, its placeholder is shown instead.

## WordPress Integration

To connect to WordPress:

### 1. Start the proxy server

```bash
WP_URL=https://your-wordpress.com node server-proxy.js
```

### 2. Update content parser

Modify `src/content-parser.js` to fetch from the proxy:

```javascript
async function fetchFromWordPress() {
    const response = await fetch('/api/posts');
    const wpPosts = await response.json();
    return wpPosts.map(wpPost => ({
        id: wpPost.slug,
        title: wpPost.title.rendered,
        date: wpPost.date,
        category: wpPost.categories[0]?.name || 'uncategorized',
        excerpt: wpPost.excerpt.rendered.replace(/<[^>]*>/g, ''),
        image: wpPost.featured_media_source_url,
        body: wpPost.content.rendered
    }));
}
```

## Troubleshooting

### "Module not found" errors
Make sure you're running a local server, not opening the file directly.

### Hallway not appearing
Check browser console for GLTF loading errors. The model path should be correct.

### Click not working
Click the scene first to enable pointer lock, then try clicking.

## License

MIT
