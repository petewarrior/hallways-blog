import { onRequestGet } from './functions/api/image.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
};

export default {
    async fetch(request, env) {
        const { pathname } = new URL(request.url);

        if (pathname === '/api/image') {
            if (request.method !== 'GET') {
                return new Response(null, {
                    status: 405,
                    headers: { ...corsHeaders, Allow: 'GET' }
                });
            }
            return onRequestGet({ request, env });
        }

        if (pathname.startsWith('/api/')) {
            return new Response('Not found', {
                status: 404,
                headers: corsHeaders
            });
        }

        return env.ASSETS.fetch(request);
    }
};
