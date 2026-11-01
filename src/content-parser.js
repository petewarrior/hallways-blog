function parseFrontMatter(content) {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);
    
    if (!match) {
        return { metadata: {}, body: content };
    }
    
    const [, frontMatter, body] = match;
    const metadata = {};
    
    frontMatter.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            metadata[key] = value;
        }
    });
    
    return { metadata, body: body.trim() };
}

function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

function convertMarkdownToHtml(markdown) {
    let html = markdown;
    
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
    
    html = html.replace(/^(\d+)\. (.*$)/gm, '<li>$2</li>');
    html = html.replace(/^- (.*$)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p><\/p>/g, '');
    
    return html;
}

async function parseMarkdownFile(filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) return null;
        
        const content = await response.text();
        const { metadata, body } = parseFrontMatter(content);
        
        return {
            id: slugify(metadata.title || filePath),
            path: filePath,
            title: metadata.title || 'Untitled',
            date: metadata.date || '',
            category: metadata.category || 'uncategorized',
            excerpt: metadata.excerpt || body.substring(0, 150) + '...',
            image: metadata.image || '',
            markdown: body,
            body: convertMarkdownToHtml(body)
        };
    } catch (error) {
        console.error(`Error parsing ${filePath}:`, error);
        return null;
    }
}

async function parseContent(postsPath) {
    const posts = [];
    const categories = new Map();

    const manifestResponse = await fetch(`${postsPath}/index.json`);
    if (!manifestResponse.ok) {
        throw new Error(`Failed to load post manifest: ${manifestResponse.status}`);
    }

    const files = await manifestResponse.json();
    if (!Array.isArray(files) || files.some(file => typeof file !== 'string')) {
        throw new Error('Post manifest must be an array of Markdown filenames');
    }

    console.log(files.length);

    const parsedPosts = await Promise.all(
        files.map(file => parseMarkdownFile(`${postsPath}/${file}`))
    );

    for (const post of parsedPosts) {
        if (post) {
            posts.push(post);
            
            const catName = post.category || 'uncategorized';
            if (!categories.has(catName)) {
                categories.set(catName, {
                    id: catName,
                    name: catName.charAt(0).toUpperCase() + catName.slice(1),
                    slug: catName,
                    posts: [],
                    postCount: 0
                });
            }
            categories.get(catName).posts.push(post);
            categories.get(catName).postCount++;
        }
    }
    
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return { posts, categories };
}

function loadWordPressConfig(values = import.meta.env) {
    const apiBaseUrl = values.VITE_WORDPRESS_API_BASE_URL?.trim();
    if (!apiBaseUrl) throw new Error('VITE_WORDPRESS_API_BASE_URL is required in the Vite environment');

    return {
        apiBaseUrl,
        parentCategoryId: values.VITE_WORDPRESS_PARENT_CATEGORY_ID?.trim() || null,
        imageProxyUrl: values.VITE_WORDPRESS_IMAGE_PROXY_URL?.trim() || ''
    };
}

async function fetchWordPressPages(apiBaseUrl, path, params = {}) {
    const items = [];
    let page = 1;
    const endpoint = `${apiBaseUrl.replace(/\/+$/, '')}/${path}`;

    while (true) {
        const query = new URLSearchParams({ ...params, per_page: '100', page: String(page) });
        const response = await fetch(`${endpoint}?${query}`);
        if (!response.ok) {
            throw new Error(`WordPress API request failed (${response.status}): ${path}`);
        }

        const pageItems = await response.json();
        if (!Array.isArray(pageItems)) {
            throw new Error(`WordPress API returned an invalid ${path} response`);
        }
        items.push(...pageItems);

        const totalPages = Number(response.headers.get('X-WP-TotalPages'));
        if (totalPages ? page >= totalPages : pageItems.length < 100) break;
        page++;
    }

    return items;
}

function stripHtml(html) {
    const element = document.createElement('div');
    element.innerHTML = html || '';
    return element.textContent.trim();
}

async function parseWordPressContent({ apiBaseUrl, parentCategoryId } = {}) {
    if (!apiBaseUrl) throw new Error('WordPress API base URL is required');
    const categoryParams = parentCategoryId ? { parent: String(parentCategoryId) } : {};
    const wordpressCategories = await fetchWordPressPages(apiBaseUrl, 'categories', categoryParams);
    const categories = new Map();
    const posts = [];

    for (const wordpressCategory of wordpressCategories) {
        const category = {
            id: String(wordpressCategory.id),
            type: 'category',
            name: stripHtml(wordpressCategory.name) || 'Uncategorized',
            slug: wordpressCategory.slug,
            posts: [],
            postCount: 0
        };
        const wordpressPosts = await fetchWordPressPages(apiBaseUrl, 'posts', {
            categories: String(wordpressCategory.id),
            _embed: 'wp:featuredmedia'
        });

        for (const wordpressPost of wordpressPosts) {
            const post = {
                id: String(wordpressPost.id),
                path: wordpressPost.link,
                title: stripHtml(wordpressPost.title?.rendered) || 'Untitled',
                date: wordpressPost.date || '',
                category: category.name,
                categoryId: category.id,
                categorySlug: category.slug,
                excerpt: stripHtml(wordpressPost.excerpt?.rendered),
                image: wordpressPost._embedded?.['wp:featuredmedia']?.[0]?.source_url || '',
                html: wordpressPost.content?.rendered || '',
                body: wordpressPost.content?.rendered || ''
            };
            category.posts.push(post);
            posts.push(post);
        }

        category.postCount = category.posts.length;
        categories.set(category.id, category);
    }

    posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    return { posts, categories };
}

export { parseContent, parseWordPressContent, loadWordPressConfig, parseMarkdownFile, convertMarkdownToHtml };
