const http = require('http');
const https = require('https');
const fs = require('fs');
const { URL } = require('url');

try {
    const envText = fs.readFileSync('.env', 'utf8');
    for (const sourceLine of envText.split(/\r?\n/)) {
        const line = sourceLine.trim();
        if (!line || line.startsWith('#')) continue;
        const separator = line.indexOf('=');
        if (separator <= 0) continue;
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = value;
    }
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}

const PORT = process.env.PROXY_PORT || 3000;
const WP_URL = process.env.WP_URL || process.env.VITE_WORDPRESS_API_BASE_URL || 'https://your-wordpress-site.com';
const ALLOWED_IMAGE_HOSTS = (process.env.WORDPRESS_IMAGE_ALLOWED_HOSTS || '')
    .split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean);

function isAllowedImageHost(hostname) {
    const host = hostname.toLowerCase();
    return ALLOWED_IMAGE_HOSTS.some(allowed => {
        if (allowed.startsWith('*.')) {
            const suffix = allowed.slice(1);
            return host.endsWith(suffix) && host.length > suffix.length;
        }
        return host === allowed;
    });
}

function proxyImage(targetUrl, res, redirects = 0) {
    if (targetUrl.protocol !== 'https:' || !isAllowedImageHost(targetUrl.hostname)) {
        res.writeHead(403, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' });
        res.end('Image host is not allowed');
        return;
    }

    const request = https.get(targetUrl, { headers: { 'User-Agent': 'HallwaysBlog/1.0' } }, upstream => {
        if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
            upstream.resume();
            if (redirects >= 4) {
                res.writeHead(502, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' });
                res.end('Too many image redirects');
                return;
            }
            proxyImage(new URL(upstream.headers.location, targetUrl), res, redirects + 1);
            return;
        }

        const contentType = upstream.headers['content-type'] || 'application/octet-stream';
        const isImagePayload = contentType.startsWith('image/');
        if (upstream.statusCode !== 200 || !isImagePayload) {
            upstream.resume();
            res.writeHead(upstream.statusCode === 200 ? 415 : upstream.statusCode, {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'text/plain'
            });
            res.end('Upstream did not return an image');
            return;
        }

        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
            'Content-Type': contentType,
            'X-Content-Type-Options': 'nosniff'
        });
        upstream.pipe(res);
    });

    request.on('error', error => {
        console.error('Image proxy error:', error);
        if (!res.headersSent) res.writeHead(502, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' });
        res.end('Unable to fetch image');
    });
}

const proxy = http.createServer((req, res) => {
    const requestUrl = new URL(req.url, 'http://localhost');
    if (requestUrl.pathname === '/api/image') {
        if (req.method !== 'GET') {
            res.writeHead(405, { 'Access-Control-Allow-Origin': '*', Allow: 'GET' });
            res.end();
            return;
        }
        const rawImageUrl = requestUrl.searchParams.get('url');
        if (!rawImageUrl || rawImageUrl.length > 4096) {
            res.writeHead(400, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' });
            res.end('A valid image URL is required');
            return;
        }
        try {
            proxyImage(new URL(rawImageUrl), res);
        } catch {
            res.writeHead(400, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'text/plain' });
            res.end('Invalid image URL');
        }
        return;
    }

    const targetUrl = new URL(req.url, WP_URL);
    
    const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers: {
            ...req.headers,
            host: targetUrl.hostname
        }
    };

    const proxyReq = (targetUrl.protocol === 'https:' ? https : http).request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('Proxy error:', err);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
    });

    req.pipe(proxyReq);
});

proxy.listen(PORT, () => {
    console.log(`WordPress proxy server running on port ${PORT}`);
    console.log(`Proxying requests to: ${WP_URL}`);
});

module.exports = proxy;
