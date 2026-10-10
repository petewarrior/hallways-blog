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

export { parseContent, parseMarkdownFile, convertMarkdownToHtml };
