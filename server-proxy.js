const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = process.env.PROXY_PORT || 3000;
const WP_URL = process.env.WP_URL || 'https://your-wordpress-site.com';

const proxy = http.createServer((req, res) => {
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
