const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const CONTENT_LEFT = 84;
const CONTENT_WIDTH = CANVAS_WIDTH - CONTENT_LEFT * 2;
const BODY_FONT = '24px Georgia, serif';
const BODY_LINE_HEIGHT = 36;

function parseMarkdownBlocks(markdown) {
    const blocks = [];
    let paragraph = [];
    let codeLines = [];
    let inCode = false;

    const flushParagraph = () => {
        if (paragraph.length) {
            blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
            paragraph = [];
        }
    };

    for (const sourceLine of String(markdown || '').split(/\r?\n/)) {
        const line = sourceLine.trim();
        if (line.startsWith('```')) {
            flushParagraph();
            if (inCode) {
                blocks.push({ type: 'code', text: codeLines.join('\n') });
                codeLines = [];
            }
            inCode = !inCode;
            continue;
        }
        if (inCode) {
            codeLines.push(sourceLine);
            continue;
        }
        if (!line) {
            flushParagraph();
            continue;
        }

        const imageMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
        const listMatch = line.match(/^([-*]|\d+\.)\s+(.*)$/);
        if (imageMatch) {
            flushParagraph();
            blocks.push({ type: 'image', alt: imageMatch[1], url: imageMatch[2] });
        } else if (headingMatch) {
            flushParagraph();
            blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
        } else if (listMatch) {
            flushParagraph();
            blocks.push({ type: 'list', text: `-  ${listMatch[2]}` });
        } else {
            paragraph.push(line);
        }
    }

    flushParagraph();
    if (codeLines.length) blocks.push({ type: 'code', text: codeLines.join('\n') });
    return blocks;
}

function parseHtmlBlocks(html) {
    const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const blocks = [];

    for (const element of parsed.body.querySelectorAll('h1, h2, h3, p, li, pre, blockquote, img')) {
        if (element.tagName === 'IMG') {
            blocks.push({ type: 'image', alt: element.getAttribute('alt') || '', url: element.getAttribute('src') || '' });
            continue;
        }
        if (element.closest('pre') && element.tagName !== 'PRE') continue;

        const text = element.textContent.trim();
        if (!text) continue;
        if (/^H[1-3]$/.test(element.tagName)) {
            blocks.push({ type: 'heading', level: Number(element.tagName[1]), text });
        } else if (element.tagName === 'PRE') {
            blocks.push({ type: 'code', text });
        } else if (element.tagName === 'LI') {
            blocks.push({ type: 'list', text: `-  ${text}` });
        } else {
            blocks.push({ type: 'paragraph', text });
        }
    }

    return blocks;
}

function plainText(markdown) {
    return String(markdown || '')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1');
}

function wrapText(context, text, maxWidth) {
    const lines = [];
    for (const paragraph of String(text).split('\n')) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        let line = '';
        for (const word of words) {
            const next = line ? `${line} ${word}` : word;
            if (line && context.measureText(next).width > maxWidth) {
                lines.push(line);
                line = word;
            } else {
                line = next;
            }
        }
        lines.push(line);
    }
    return lines;
}

function loadImage(url, timeoutMs = 15000) {
    return new Promise(resolve => {
        if (!url) {
            resolve(null);
            return;
        }

        const image = new Image();
        image.crossOrigin = 'anonymous';
        let settled = false;
        const finish = result => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            resolve(result);
        };
        const timeout = setTimeout(() => {
            image.src = '';
            finish(null);
        }, timeoutMs);

        image.onload = () => finish(image);
        image.onerror = () => finish(null);
        image.src = url;
        if (image.complete && image.naturalWidth) finish(image);
    });
}

class PostCanvas {
    constructor(options) {
        this.canvas = options.canvas;
        this.context = this.canvas.getContext('2d');
        this.imageProxyUrl = options.imageProxyUrl || '';
        this.onRender = options.onRender || (() => {});
        this.active = false;
        this.scrollY = 0;
        this.maxScroll = 0;
        this.items = [];
        this.images = new Map();
        this.imagePanels = [];
        this.post = null;
        this.wheelHandler = event => {
            if (!this.active) return;
            this.scrollBy(event.deltaY);
            event.preventDefault();
        };
        this.keyHandler = event => {
            if (!this.active) return;
            if (event.key === 'PageDown') this.scrollBy(CANVAS_HEIGHT * 0.7);
            if (event.key === 'PageUp') this.scrollBy(-CANVAS_HEIGHT * 0.7);
        };
        window.addEventListener('wheel', this.wheelHandler, { passive: false });
        window.addEventListener('keydown', this.keyHandler);
    }

    async prepare(post) {
        this.post = post;
        this.active = true;
        this.scrollY = 0;
        const blocks = post.html
            ? parseHtmlBlocks(post.html)
            : parseMarkdownBlocks(post.markdown || post.body || '');
        const imageBlocks = blocks.filter(block => block.type === 'image');
        const postUrl = new URL(post.path || 'content/posts/', document.baseURI);
        const resolveImageUrl = url => {
            const resolvedUrl = new URL(url, postUrl).href;
            return this.imageProxyUrl
                ? `${this.imageProxyUrl}${encodeURIComponent(resolvedUrl)}`
                : resolvedUrl;
        };
        imageBlocks.forEach(block => {
            block.url = resolveImageUrl(block.url);
        });
        this.featuredImageUrl = post.image ? resolveImageUrl(post.image) : '';
        const urls = new Set(imageBlocks.map(block => block.url));
        if (this.featuredImageUrl) urls.add(this.featuredImageUrl);

        const entries = await Promise.all(Array.from(urls, async url => [url, await loadImage(url)]));
        this.images = new Map(entries);
        const panels = new Map();
        if (this.featuredImageUrl) panels.set(this.featuredImageUrl, { url: this.featuredImageUrl, alt: post.title || 'Featured image' });
        imageBlocks.forEach(block => {
            if (!panels.has(block.url)) panels.set(block.url, { url: block.url, alt: block.alt });
        });
        this.imagePanels = Array.from(panels.values(), panel => {
            const image = this.images.get(panel.url);
            const available = Boolean(image?.naturalWidth && image?.naturalHeight);
            return {
                ...panel,
                available,
                aspect: available ? image.naturalWidth / image.naturalHeight : null
            };
        });
        this.layout(post, blocks);
        await document.fonts?.ready;
        await new Promise(resolve => requestAnimationFrame(resolve));
        this.draw();
    }

    layout(post, blocks) {
        const context = this.context;
        let y = 72;
        this.items = [];

        context.font = 'bold 48px Georgia, serif';
        const titleLines = wrapText(context, post.title || 'Untitled', CONTENT_WIDTH);
        this.items.push({ type: 'text', lines: titleLines, x: CONTENT_LEFT, y, font: context.font, color: '#292B27', lineHeight: 58 });
        y += titleLines.length * 58 + 18;

        context.font = '18px Arial, sans-serif';
        const metadata = [post.date, post.category].filter(Boolean).join('  ·  ');
        if (metadata) {
            this.items.push({ type: 'text', lines: [metadata], x: CONTENT_LEFT, y, font: context.font, color: '#687067', lineHeight: 28 });
            y += 52;
        }

        if (post.excerpt) {
            context.font = 'italic 22px Georgia, serif';
            const lines = wrapText(context, post.excerpt, CONTENT_WIDTH);
            this.items.push({ type: 'text', lines, x: CONTENT_LEFT, y, font: context.font, color: '#555950', lineHeight: 32 });
            y += lines.length * 32 + 28;
        }

        for (const block of blocks.filter(block => block.type !== 'image')) {
            const isHeading = block.type === 'heading';
            const isCode = block.type === 'code';
            const font = isHeading
                ? `bold ${block.level === 1 ? 36 : 29}px Georgia, serif`
                : isCode ? '20px monospace' : BODY_FONT;
            context.font = font;
            const lines = wrapText(context, plainText(block.text), CONTENT_WIDTH - (isCode ? 40 : 0));
            const lineHeight = isHeading ? 46 : isCode ? 30 : BODY_LINE_HEIGHT;
            const height = lines.length * lineHeight + (isCode ? 40 : 0);
            this.items.push({ type: isCode ? 'code' : 'text', lines, x: CONTENT_LEFT, y, font, color: isHeading ? '#363A32' : '#343630', lineHeight, height });
            y += height + (isHeading ? 24 : 18);
        }

        this.documentHeight = y + 72;
        this.maxScroll = Math.max(0, this.documentHeight - CANVAS_HEIGHT);
    }

    draw() {
        const context = this.context;
        context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        context.fillStyle = '#F4F2EA';
        context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        context.fillStyle = '#B35C3A';
        context.fillRect(0, 0, 9, CANVAS_HEIGHT);

        context.save();
        context.translate(0, -this.scrollY);
        for (const item of this.items) {
            if (item.type === 'image') {
                const image = this.images.get(item.url);
                if (image) {
                    const scale = Math.min(item.width / image.naturalWidth, item.height / image.naturalHeight);
                    const width = image.naturalWidth * scale;
                    const height = image.naturalHeight * scale;
                    context.drawImage(image, item.x, item.y, width, height);
                } else {
                    context.fillStyle = '#E4E0D6';
                    context.fillRect(item.x, item.y, item.width, item.height);
                    context.fillStyle = '#66685F';
                    context.font = '18px Arial, sans-serif';
                    context.fillText(item.alt || 'Image unavailable', item.x + 24, item.y + 42);
                }
                continue;
            }

            if (item.type === 'code') {
                context.fillStyle = '#E8E5DC';
                context.fillRect(item.x - 20, item.y - 12, CONTENT_WIDTH + 40, item.height);
            }
            context.font = item.font;
            context.fillStyle = item.color;
            item.lines.forEach((line, index) => {
                context.fillText(line, item.x, item.y + index * item.lineHeight);
            });
        }
        context.restore();

        if (this.maxScroll > 0) {
            const trackY = CANVAS_HEIGHT - 18;
            const thumbWidth = Math.max(40, (CANVAS_HEIGHT / this.documentHeight) * (CANVAS_WIDTH - 36));
            const thumbX = 18 + (this.scrollY / this.maxScroll) * (CANVAS_WIDTH - 36 - thumbWidth);
            context.fillStyle = '#D5D1C7';
            context.fillRect(18, trackY, CANVAS_WIDTH - 36, 4);
            context.fillStyle = '#B35C3A';
            context.fillRect(thumbX, trackY - 3, thumbWidth, 10);
        }
        this.onRender();
    }

    scrollBy(amount) {
        const next = Math.max(0, Math.min(this.maxScroll, this.scrollY + amount));
        if (next === this.scrollY) return;
        this.scrollY = next;
        this.draw();
    }

    scrollToRatio(ratio) {
        const next = Math.max(0, Math.min(1, ratio)) * this.maxScroll;
        if (Math.abs(next - this.scrollY) < 1) return;
        this.scrollY = next;
        this.draw();
    }

    getImagePanels() {
        return this.imagePanels;
    }

    clear() {
        this.active = false;
        this.scrollY = 0;
        this.maxScroll = 0;
        this.post = null;
        this.featuredImageUrl = '';
        this.imagePanels = [];
        this.items = [];
        this.images.clear();
        this.context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
}

export { PostCanvas };
