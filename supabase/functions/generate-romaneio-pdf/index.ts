import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@^1.17.1?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    // Criar cliente com SERVICE_ROLE_KEY para acesso ao banco
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Extrair token do header Authorization
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || null

    // Se tiver token, validar usuário
    let userId = null
    if (token) {
      try {
        const supabaseUser = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        )
        
        const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token)
        if (!authError && user) {
          userId = user.id
        }
      } catch (e) {
        console.log('Erro ao validar token:', e)
      }
    }

    const { romaneioId } = await req.json()

    if (!romaneioId) throw new Error('ID do romaneio obrigatório')

    // 1. Buscar Dados do Romaneio Completo
    const { data: romaneio, error: romError } = await supabaseAdmin
      .from('romaneios')
      .select(`
        *,
        lot:lots(nome),
        client:clients(nome, telefone, email)
      `)
      .eq('id', romaneioId)
      .single()

    if (romError || !romaneio) throw new Error('Romaneio não encontrado')

    // Se tiver userId, verificar acesso
    if (userId) {
      const { data: clientData } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('auth_id', userId)
        .single()

      if (!clientData || clientData.id !== romaneio.client_id) {
        return new Response(
          JSON.stringify({ error: 'Acesso negado a este romaneio' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 2. Buscar Itens do Romaneio (Pedidos)
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('orders')
      .select(`
        *,
        product:products(nome, codigo_sku)
      `)
      .eq('lot_id', romaneio.lot_id)
      .eq('client_id', romaneio.client_id)
      .neq('status', 'cancelado')

    if (itemsError) throw new Error('Erro ao buscar itens')

    // 3. Gerar PDF
    const pdfDoc = await PDFDocument.create()
    let page = pdfDoc.addPage([595.28, 841.89]) // A4
    const { width, height } = page.getSize()
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    const drawText = (text, x, y, size = 10, isBold = false, color = rgb(0, 0, 0)) => {
      page.drawText(String(text), {
        x,
        y,
        size,
        font: isBold ? fontBold : font,
        color,
      })
    }

    // --- Header ---
    page.drawRectangle({
        x: 0, y: height - 100, width, height: 100,
        color: rgb(0.06, 0.09, 0.16) // #0f172a (Slate 900)
    })
    
    drawText('ARTEA JOIAS', 50, height - 50, 24, true, rgb(1,1,1))
    drawText('Romaneio de Conferência', 50, height - 70, 12, false, rgb(0.8,0.8,0.8))
    
    // Info Direita
    drawText(`Nº: ${romaneio.numero_romaneio}`, width - 150, height - 50, 12, true, rgb(1,1,1))
    drawText(`Data: ${new Date(romaneio.created_at).toLocaleDateString('pt-BR')}`, width - 150, height - 70, 10, false, rgb(0.8,0.8,0.8))

    // --- Cliente Info ---
    let y = height - 140
    drawText('DADOS DO CLIENTE', 50, y, 12, true)
    y -= 20
    drawText(`Nome: ${romaneio.cliente_nome_snapshot || romaneio.client?.nome}`, 50, y)
    drawText(`Telefone: ${romaneio.cliente_telefone_snapshot || romaneio.client?.telefone}`, 300, y)
    y -= 15
    
    // Grupo Info
    y -= 20
    drawText('DADOS DO GRUPO', 50, y, 12, true)
    y -= 20
    drawText(`Grupo: ${romaneio.lot?.nome}`, 50, y)
    y -= 40

    // --- Tabela Header ---
    const colX = { prod: 50, qtd: 350, unit: 420, total: 500 }
    
    page.drawRectangle({ x: 40, y: y - 5, width: width - 80, height: 25, color: rgb(0.95, 0.95, 0.95) })
    drawText('PRODUTO', colX.prod, y, 10, true)
    drawText('QTD', colX.qtd, y, 10, true)
    drawText('UNIT', colX.unit, y, 10, true)
    drawText('TOTAL', colX.total, y, 10, true)
    y -= 25

    // --- Itens ---
    let totalQtd = 0
    let totalValor = 0

    items.forEach((item) => {
        if (y < 50) { // Nova página se acabar espaço
             page = pdfDoc.addPage([595.28, 841.89])
             y = height - 50
        }

        const nomeProd = item.product?.nome || 'Produto Indefinido'
        const sku = item.product?.codigo_sku ? `(${item.product.codigo_sku})` : ''
        
        drawText(`${nomeProd} ${sku}`.substring(0, 50), colX.prod, y)
        drawText(item.quantidade.toString(), colX.qtd, y)
        drawText(`R$ ${item.valor_unitario.toFixed(2)}`, colX.unit, y)
        drawText(`R$ ${item.valor_total.toFixed(2)}`, colX.total, y)
        
        // Linha separadora
        page.drawLine({
            start: { x: 40, y: y - 5 },
            end: { x: width - 40, y: y - 5 },
            thickness: 0.5,
            color: rgb(0.9, 0.9, 0.9),
        })

        totalQtd += item.quantidade
        totalValor += item.valor_total
        y -= 25
    })

    // --- Totais ---
    y -= 10
    page.drawRectangle({ x: 300, y: y - 40, width: 250, height: 60, color: rgb(0.98, 0.98, 0.98), borderColor: rgb(0.9,0.9,0.9), borderWidth: 1 })
    
    y -= 15
    drawText('Total Itens:', 320, y, 10, false)
    drawText(totalQtd.toString(), 500, y, 10, true)
    
    y -= 20
    drawText('VALOR TOTAL:', 320, y, 12, true)
    drawText(`R$ ${totalValor.toFixed(2)}`, 500, y, 12, true)

    // Footer Legal
    drawText('Este documento é um comprovante de conferência de compra coletiva.', 50, 40, 8, false, rgb(0.5,0.5,0.5))
    drawText('Artea Joias - Sistema de Gestão', 50, 30, 8, false, rgb(0.5,0.5,0.5))

    const pdfBytes = await pdfDoc.save()

    return new Response(pdfBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
      },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
