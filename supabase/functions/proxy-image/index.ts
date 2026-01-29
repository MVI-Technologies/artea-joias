import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        const targetUrl = url.searchParams.get('url')

        if (!targetUrl) {
            return new Response(JSON.stringify({ error: 'Missing "url" parameter' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // console.log(`Proxying request to: ${targetUrl}`)

        const response = await fetch(targetUrl)

        // Copy relevant headers from the original response or just invoke blob()
        const blob = await response.blob()
        const contentType = response.headers.get('content-type') || 'application/octet-stream'

        return new Response(blob, {
            headers: {
                ...corsHeaders,
                'Content-Type': contentType,
                // Cache control to improve performance
                'Cache-Control': 'public, max-age=3600'
            },
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
