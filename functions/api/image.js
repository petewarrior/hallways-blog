const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
};

function imageError(status, message) {
    return new Response(message, {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
}

function isAllowedHost(hostname, allowedHosts) {
    const host = hostname.toLowerCase();
    return allowedHosts.some(allowed => {
        if (allowed.startsWith('*.')) {
            const suffix = allowed.slice(1);
            return host.endsWith(suffix) && host.length > suffix.length;
        }
        return host === allowed;
    });
}

async function fetchImage(url, allowedHosts, redirects = 0) {
    if (url.protocol !== 'https:' || !isAllowedHost(url.hostname, allowedHosts)) {
        return imageError(403, 'Image host is not allowed');
    }

    const upstream = await fetch(url, {
        headers: { 'User-Agent': 'HallwaysBlog/1.0' },
        redirect: 'manual'
    });
    if (upstream.status >= 300 && upstream.status < 400) {
        const location = upstream.headers.get('Location');
        await upstream.body?.cancel();
        if (!location) return imageError(502, 'Image redirect did not include a location');
        if (redirects >= 4) return imageError(502, 'Too many image redirects');
        return fetchImage(new URL(location, url), allowedHosts, redirects + 1);
    }

    const contentType = upstream.headers.get('Content-Type') || '';
    if (upstream.status !== 200 || !contentType.toLowerCase().startsWith('image/')) {
        await upstream.body?.cancel();
        return imageError(upstream.status === 200 ? 415 : upstream.status, 'Upstream did not return an image');
    }

    return new Response(upstream.body, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': contentType }
    });
}

export async function onRequestGet({ request, env }) {
    const imageUrl = new URL(request.url).searchParams.get('url');
    if (!imageUrl || imageUrl.length > 4096) return imageError(400, 'A valid image URL is required');

    const allowedHosts = String(env.WORDPRESS_IMAGE_ALLOWED_HOSTS || '')
        .split(',')
        .map(host => host.trim().toLowerCase())
        .filter(Boolean);
    if (!allowedHosts.length) return imageError(503, 'Image proxy is not configured');

    try {
        return await fetchImage(new URL(imageUrl), allowedHosts);
    } catch {
        return imageError(400, 'Invalid image URL');
    }
}
