# 3D Blog

A blog you can walk through, built with A-Frame.

## Features

- **Loading visualization**: Hallway extends as content loads
- **Dashboard**: Central room with recent posts and category halls
- **Category rooms**: Polygon rooms for ≤20 posts, corridors for >20
- **Post rooms**: Entry corridor → text wall → floating images
- **Navigation**: WASD + mouse, click-to-teleport, physical hallways
- **VR Support**: Works with VR headsets via WebXR

## Quick Start

### 1. Install dependencies (optional, for dev features)

```bash
npm install
```

### 2. Start a local server

Due to ES modules and cross-origin restrictions, you need a local server:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```

### 3. Open in browser

Navigate to `http://localhost:8000`

## Controls

| Action | Desktop | VR |
|--------|---------|-----|
| Move | WASD | Thumbstick/trackpad |
| Look | Mouse drag | Head tracking |
| Select | Click | Gaze + controller trigger |
| Go Back | Click UI button / Esc | Controller button |

## Project Structure

```
/hallways
├── index.html              - Entry point, A-Frame scene
├── main.js                 - App initialization
├── styles.css              - UI styling
├── server-proxy.js         - WordPress proxy (optional)
│
├── content/
│   ├── config.json         - Site configuration
│   └── posts/              - Markdown blog posts
│
├── src/
│   ├── content-parser.js   - Parse markdown to posts
│   ├── room-generator.js   - Create 3D rooms
│   ├── hallway-loader.js   - Loading hallway extension
│   ├── navigation.js       - WASD, room transitions
│   └── post-panel.js       - A-Frame components
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

### Categories

Categories are auto-generated based on the `category` field in posts. Posts with the same category appear together.

### Configuration

Edit `content/config.json`:

```json
{
    "title": "My 3D Blog",
    "description": "A blog you can walk through",
    "recentPostsCount": 5,
    "postThreshold": 20,
    "accentColor": "#4A90D9"
}
```

## Room Types

| Room | Trigger | Layout |
|------|---------|--------|
| **Loading** | Page loading | Hallway extends ahead |
| **Dashboard** | Enter after loading | Central platform, 5 recent posts, N category halls |
| **Category (≤20 posts)** | Enter category hall | N-gon polygon, 1 entryway per side |
| **Category (>20 posts)** | Enter category hall | Straight corridor, n/2 entryways per side |
| **Post** | Enter post corridor | Entry corridor → text wall → floating images |

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
