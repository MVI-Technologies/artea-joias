import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Format expected: /preview-catalog?id=<lot_id_or_link>
    const id = url.searchParams.get('id');

    if (!id) {
      return new Response('ID is required', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Try to find by UUID (direct ID)
    let lot;
    const { data: lotById, error: errorId } = await supabase
      .from('lots')
      .select('id, nome, descricao, cover_image_url, link_compra')
      .eq('id', id)
      .single();

    if (lotById) {
      lot = lotById;
    } else {
      // 2. Try to find by link_compra (slug)
      const { data: lotByLink, error: errorLink } = await supabase
        .from('lots')
        .select('id, nome, descricao, cover_image_url, link_compra')
        .eq('link_compra', id)
        .single();
      
      if (lotByLink) {
        lot = lotByLink;
      }
    }

    if (!lot) {
      // Fallback for not found
      return new Response('Catalog not found', { status: 404 });
    }

    let imageUrl = lot.cover_image_url;
    
    // Fallback image logic if no cover image
    if (!imageUrl) {
        // Try to get first product image
        const { data: products } = await supabase
            .from('lot_products')
            .select('product:products(imagem1)')
            .eq('lot_id', lot.id)
            .limit(1);
        
        if (products && products.length > 0 && products[0].product?.imagem1) {
            imageUrl = products[0].product.imagem1;
            console.log('Using product image:', imageUrl);
        } else {
            // System branding fallback
            imageUrl = 'https://www.grupoaadecomprascoletivas.site/logo.png'; 
            console.log('Using fallback logo:', imageUrl);
        }
    }

    // Ensure absolute URL
    if (imageUrl && !imageUrl.startsWith('http')) {
        // If it's a relative path, we try to construct a storage URL
        // We assume it might be in catalog-covers or products if it's just a filename
        // But since we don't know the bucket easily, this is a best-effort.
        // However, if it starts with /, it might be a local asset in Vercel? Unlikely for DB content.
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        if (supabaseUrl && !imageUrl.startsWith('/')) {
             // Heuristic: if it looks like a filename, assume catalog-covers
             imageUrl = `${supabaseUrl}/storage/v1/object/public/catalog-covers/${imageUrl}`;
             console.log('Constructed storage URL:', imageUrl);
        } else if (imageUrl.startsWith('/')) {
             // Relative to frontend domain
             imageUrl = `https://www.grupoaadecomprascoletivas.site${imageUrl}`;
             console.log('Constructed frontend URL:', imageUrl);
        }
    }
    const title = lot.nome || 'Catálogo Grupo AA de Semijoias';
    const description = lot.descricao || 'Participe do grupo de compras e garanta preços especiais.';
    const frontendUrl = 'https://www.grupoaadecomprascoletivas.site'; 
    const finalUrl = `${frontendUrl}/app/catalogo/${lot.link_compra || lot.id}`;


    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        
        <!-- Open Graph -->
        <meta property="og:type" content="website" />
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:image" content="${imageUrl}" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content="${finalUrl}" />
        
        <!-- Twitter -->
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}" />
        <meta name="twitter:image" content="${imageUrl}" />
        
        <!-- Redirect for non-bots or just in case -->
        <meta http-equiv="refresh" content="0;url=${finalUrl}" />
        <script>window.location.href = "${finalUrl}"</script>
      </head>
      <body>
        <p>Redirecionando para o catálogo...</p>
      </body>
      </html>
    `;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60', // Short cache for updates
        ...corsHeaders
      },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
