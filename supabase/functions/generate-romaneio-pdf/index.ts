import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@^1.17.1?target=deno'
import QRCode from 'https://esm.sh/qrcode@1.5.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// === PIX BR CODE HELPERS ===
function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021
      else crc = crc << 1
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0')
}

function formatField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0')
  return `${id}${len}${value}`
}

function generatePixPayload({
  key,
  name,
  city = 'BRASIL',
  amount,
  txtId = '***',
}: {
  key: string
  name: string
  city?: string
  amount?: number
  txtId?: string
}): string {
  const cleanKey = key.trim()
  const cleanName = name.substring(0, 25).trim() // Max 25 chars
  const cleanCity = city.substring(0, 15).trim() // Max 15 chars
  const cleanTxtId = txtId.substring(0, 25).trim() || '***'

  let payload =
    formatField('00', '01') + // Format Indicator
    formatField('26', // Merchant Account Information
      formatField('00', 'BR.GOV.BCB.PIX') +
      formatField('01', cleanKey)
    ) +
    formatField('52', '0000') + // Merchant Category Code
    formatField('53', '986') // Transaction Currency (BRL)

  if (amount && amount > 0) {
    payload += formatField('54', amount.toFixed(2)) // Transaction Amount
  }

  payload +=
    formatField('58', 'BR') + // Country Code
    formatField('59', cleanName) + // Merchant Name
    formatField('60', cleanCity) + // Merchant City
    formatField('62', // Additional Data Field Template
      formatField('05', cleanTxtId) // Reference Label
    ) +
    '6304' // CRC16 ID + Length placeholder

  // Calculate CRC
  payload += crc16(payload)
  return payload
}
// ==========================

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

    const { romaneioId, items: requestItems } = await req.json()

    if (!romaneioId) throw new Error('ID do romaneio obrigatório')

    // 0. Buscar configurações de pagamento da tabela integrations
    const { data: pixIntegration } = await supabaseAdmin
      .from('integrations')
      .select('config')
      .eq('type', 'pix')
      .single()

    const { data: mpIntegration } = await supabaseAdmin
      .from('integrations')
      .select('config')
      .eq('type', 'mercadopago')
      .single()

    const pixConfig = pixIntegration?.config || {}
    const mpConfig = mpIntegration?.config || {}

    // 1. Buscar Dados do Romaneio Completo
    const { data: romaneio, error: romError } = await supabaseAdmin
      .from('romaneios')
      .select(`
        *,
        lot:lots(
          id,
          nome,
          updated_at,
          requer_pacote_fechado,
          chave_pix,
          nome_beneficiario,
          telefone_financeiro,
          mensagem_pagamento,
          observacoes_rodape
        ),
        client:clients(nome, telefone, email, cpf)
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

    const snapshotItems = (romaneio?.dados && typeof romaneio.dados === 'object')
      ? (romaneio.dados.items || romaneio.dados.itens)
      : null
    let items: any[] = []
    if (Array.isArray(requestItems)) {
      items = requestItems
    } else if (Array.isArray(snapshotItems)) {
      items = snapshotItems
    } else {
      const { data: dbItems, error: itemsError } = await supabaseAdmin
        .from('orders')
        .select(`
          *,
          product:products(
            nome,
            descricao,
            codigo_sku,
            category:categories(nome)
          )
        `)
        .eq('romaneio_id', romaneioId)
        .neq('status', 'cancelado')

      if (itemsError) throw new Error('Erro ao buscar itens')
      items = dbItems || []
    }

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

    const drawCenteredText = (text, y, size = 12, isBold = false, color = rgb(0, 0, 0)) => {
      const textWidth = (isBold ? fontBold : font).widthOfTextAtSize(String(text), size)
      const x = (width - textWidth) / 2
      drawText(text, x, y, size, isBold, color)
    }

    const drawTextRight = (text, rightX, y, size = 10, isBold = false, color = rgb(0, 0, 0)) => {
      const textWidth = (isBold ? fontBold : font).widthOfTextAtSize(String(text), size)
      drawText(text, rightX - textWidth, y, size, isBold, color)
    }

    const drawLabelValue = (label, value, x, y, size = 10) => {
      drawText(label, x, y, size, true)
      const labelWidth = fontBold.widthOfTextAtSize(`${label} `, size)
      drawText(value || '-', x + labelWidth + 2, y, size, false)
    }

    const formatCurrency = (value) => `R$ ${Number(value || 0).toFixed(2)}`

    const formatDateTime = (date) => {
      if (!date) return '-'
      return new Date(date).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    }

    const formatCpf = (value) => {
      if (!value) return '-'
      const digits = String(value).replace(/\D/g, '')
      if (digits.length === 11) {
        return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      }
      if (digits.length === 14) {
        return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
      }
      return value
    }

    const formatPhone = (value) => {
      if (!value) return '-'
      const digits = String(value).replace(/\D/g, '')
      if (digits.startsWith('55')) {
        const d = digits.slice(2)
        if (d.length === 11) {
          return `+55 (${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
        }
        if (d.length === 10) {
          return `+55 (${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
        }
      }
      if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
      }
      if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
      }
      return value
    }

    const wrapText = (text, maxWidth, size = 10, isBold = false) => {
      const content = String(text || '')
      if (!content) return ['']
      const words = content.split(' ')
      const lines: string[] = []
      let current = ''
      const currentFont = isBold ? fontBold : font
      words.forEach((word) => {
        const testLine = current ? `${current} ${word}` : word
        const testWidth = currentFont.widthOfTextAtSize(testLine, size)
        if (testWidth <= maxWidth) {
          current = testLine
        } else {
          if (current) lines.push(current)
          current = word
        }
      })
      if (current) lines.push(current)
      return lines
    }

    const truncateText = (text, maxWidth, size = 10, isBold = false) => {
      const value = String(text || '')
      const currentFont = isBold ? fontBold : font
      if (currentFont.widthOfTextAtSize(value, size) <= maxWidth) return value
      let truncated = value
      while (truncated.length > 0) {
        truncated = truncated.slice(0, -1)
        const test = `${truncated}...`
        if (currentFont.widthOfTextAtSize(test, size) <= maxWidth) return test
      }
      return ''
    }

    const lotNome = romaneio.lot?.nome || '-'
    const requerPacoteTexto = romaneio.lot?.requer_pacote_fechado ? '' : '(Não precisa fechar pacotes)'
    const pedidoNumero = romaneio.numero_pedido || '-'
    const clienteNome = romaneio.cliente_nome_snapshot || romaneio.client?.nome || romaneio.dados?.nome || '-'
    const clienteTelefone = formatPhone(
      romaneio.cliente_telefone_snapshot || romaneio.client?.telefone || romaneio.dados?.telefone
    )
    const clienteEmail = romaneio.client?.email || romaneio.dados?.email || '-'
    const clienteCpf = formatCpf(
      romaneio.client?.cpf || romaneio.dados?.cpf || romaneio.dados?.cpf_cnpj || romaneio.dados?.cpfCnpj
    )
    const dataFechamento = formatDateTime(romaneio.lot?.updated_at || romaneio.created_at)

    const dadosPagamento = (typeof romaneio.dados_pagamento === 'object' && romaneio.dados_pagamento)
      ? romaneio.dados_pagamento
      : (romaneio.dados?.dados_pagamento || romaneio.dados?.pagamento || {})
    
    // PRIORIDADE: 1. Integrations (config global) > 2. dados_pagamento do romaneio > 3. lot
    const pixData = dadosPagamento.pix || dadosPagamento
    
    // Usar pixConfig da tabela integrations como fonte principal
    const pixKey = pixConfig.chave || pixData.chave || pixData.chave_pix || dadosPagamento.chave_pix || romaneio.lot?.chave_pix || ''
    const nomeBeneficiario = pixConfig.nome_beneficiario || pixData.nome_beneficiario || dadosPagamento.nome_beneficiario || romaneio.lot?.nome_beneficiario || ''
    const cidadeBeneficiario = pixConfig.cidade || 'BRASIL'
    const telefoneFinanceiro = formatPhone(pixData.telefone_financeiro || dadosPagamento.telefone_financeiro || romaneio.lot?.telefone_financeiro)
    const mensagemPagamento = pixData.mensagem || dadosPagamento.mensagem_pagamento || romaneio.lot?.mensagem_pagamento || ''

    const getItemQuantidade = (item) => Number(item.quantidade ?? item.quantity ?? 0)
    const getItemValorUnitario = (item) => Number(item.valor_unitario ?? item.valorUnitario ?? item.preco ?? 0)
    const getItemValorTotal = (item) => {
      if (item.valor_total != null) return Number(item.valor_total)
      if (item.valorTotal != null) return Number(item.valorTotal)
      return getItemValorUnitario(item) * getItemQuantidade(item)
    }

    const totalProdutosFallback = items.reduce((sum, item) => sum + getItemValorTotal(item), 0)
    const quantidadeItensFallback = items.reduce((sum, item) => sum + getItemQuantidade(item), 0)
    const valorProdutos = Number(romaneio.valor_produtos ?? totalProdutosFallback)
    const taxaSeparacao = Number(romaneio.taxa_separacao ?? 0)
    const descontoCredito = Number(romaneio.desconto_credito ?? 0)
    const quantidadeItens = Number(romaneio.quantidade_itens ?? quantidadeItensFallback)
    const valorTotal = Number(romaneio.valor_total ?? (valorProdutos + taxaSeparacao - descontoCredito))

    const margin = 50
    let y = height - 60

    // Cabeçalho simples
    drawCenteredText('A', y, 20, true, rgb(0.6, 0.6, 0.6))
    y -= 24
    drawCenteredText('ARTEA JOIAS', y, 16, true)
    y -= 12
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    })
    y -= 20

    drawText(`Romaneio do Link ${lotNome} ${requerPacoteTexto}`.trim(), margin, y, 11, false)
    drawTextRight(`Pedido nº ${pedidoNumero}`, width - margin, y, 10, false, rgb(0.4, 0.4, 0.4))
    y -= 18

    // Dados do cliente
    const clientBoxHeight = 78
    const clientBoxY = y - clientBoxHeight
    page.drawRectangle({
      x: margin,
      y: clientBoxY,
      width: width - margin * 2,
      height: clientBoxHeight,
      borderColor: rgb(0.85, 0.85, 0.85),
      borderWidth: 1,
    })
    let infoY = y - 16
    drawLabelValue('Cliente:', clienteNome, margin + 10, infoY, 10)
    infoY -= 14
    drawLabelValue('CPF/CNPJ:', clienteCpf, margin + 10, infoY, 10)
    infoY -= 14
    drawLabelValue('WhatsApp:', clienteTelefone, margin + 10, infoY, 10)
    infoY -= 14
    drawLabelValue('E-mail:', clienteEmail, margin + 10, infoY, 10)
    infoY -= 14
    drawLabelValue('Data Fechamento:', dataFechamento, margin + 10, infoY, 10)
    y = clientBoxY - 20

    const colX = {
      img: margin,
      cat: margin + 20,
      desc: margin + 100,
      unit: margin + 280,
      qty: margin + 350,
      total: margin + 410,
    }

    const drawTableHeader = () => {
      page.drawRectangle({
        x: margin,
        y: y - 15,
        width: width - margin * 2,
        height: 20,
        borderColor: rgb(0.85, 0.85, 0.85),
        borderWidth: 0.8,
        color: rgb(0.97, 0.97, 0.97),
      })
      drawText('', colX.img, y - 2, 9, true)
      drawText('CATEGORIA', colX.cat, y - 2, 9, true)
      drawText('DESCRIÇÃO', colX.desc, y - 2, 9, true)
      drawText('VALOR', colX.unit, y + 5, 8, true)
      drawText('UNITÁRIO', colX.unit, y - 5, 8, true)
      drawText('QUANTIDADE', colX.qty, y - 2, 8, true)
      drawText('VALOR', colX.total, y + 5, 8, true)
      drawText('TOTAL', colX.total, y - 5, 8, true)
      y -= 24
    }

    const ensureSpace = (space) => {
      if (y < space) {
        page = pdfDoc.addPage([595.28, 841.89])
        y = height - 60
        drawTableHeader()
      }
    }

    // Tabela de produtos
    drawTableHeader()
    items.forEach((item) => {
      ensureSpace(120)
      const product = item.product || item.produto || item
      const categoria = product?.category?.nome || product?.categoria?.nome || product?.categoria_nome || '-'
      const descricaoBase = product?.descricao || product?.nome || item.descricao || item.nome || 'Produto Indefinido'
      const descricao = truncateText(descricaoBase, 160, 9, false)
      const quantidade = getItemQuantidade(item)
      const valorUnitario = formatCurrency(getItemValorUnitario(item))
      const valorTotalItem = formatCurrency(getItemValorTotal(item))

      drawText('', colX.img, y, 9)
      drawText(truncateText(categoria, 70, 9), colX.cat, y, 9)
      drawText(descricao, colX.desc, y, 9)
      drawText(valorUnitario, colX.unit, y, 9)
      drawText(String(quantidade), colX.qty + 10, y, 9)
      drawText(valorTotalItem, colX.total, y, 9)

      page.drawLine({
        start: { x: margin, y: y - 6 },
        end: { x: width - margin, y: y - 6 },
        thickness: 0.5,
        color: rgb(0.9, 0.9, 0.9),
      })
      y -= 18
    })

    y -= 8
    page.drawLine({
      start: { x: margin, y },
      end: { x: width - margin, y },
      thickness: 1,
      color: rgb(0, 0, 0),
    })
    y -= 20

    if (y < 250) { // Precisa de espaço para resumo + pagamento + QR Code
      page = pdfDoc.addPage([595.28, 841.89])
      y = height - 60
    }

    // Resumo financeiro
    drawText(`• Valor Total da Compra: ${formatCurrency(valorTotal)}`, margin, y, 10, true)
    y -= 16
    drawText(`• Valor Produtos: ${formatCurrency(valorProdutos)}`, margin + 10, y, 9, false)
    y -= 14
    if (descontoCredito > 0) {
      drawText(`○ Desconto (crédito anterior): ${formatCurrency(descontoCredito)}`, margin + 20, y, 9, false)
      y -= 14
    }
    drawText(`• Custo Separação: ${formatCurrency(taxaSeparacao)}`, margin + 10, y, 9, false)
    y -= 14
    drawText(`• Quantidade Total de Produtos: ${quantidadeItens}`, margin + 10, y, 9, false)
    y -= 22

    // Dados para pagamento com QR Code
    const pagamentoWidth = width - margin * 2 - 10
    
    // Gerar QR Code se tiver chave PIX
    let qrBuffer = null
    let pixPayload = ''
    if (pixKey) {
        try {
            pixPayload = generatePixPayload({
                key: pixKey,
                name: nomeBeneficiario || 'ARTEA JOIAS',
                city: cidadeBeneficiario || 'BRASIL',
                amount: valorTotal > 0 ? valorTotal : undefined,
                txtId: romaneio.numero_romaneio || 'ROMANEIO'
            })
            const qrBase64 = await QRCode.toDataURL(pixPayload, { errorCorrectionLevel: 'M' })
            const base64Data = qrBase64.replace(/^data:image\/png;base64,/, '')
            qrBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
        } catch (e) {
            console.error('Erro ao gerar QR Code:', e)
        }
    }

    const payTopY = y
    // Area de texto (esquerda) e QR Code (direita)
    // Calcula altura necessária
    const pagamentoLines = [
      { text: 'Dados para o pagamento:', bold: true, color: rgb(0, 0, 0) },
      { text: 'PAGAMENTO VIA PIX OU CARTÃO DE CRÉDITO.', bold: true, color: rgb(0, 0, 0) },
    ]
    if (pixKey) pagamentoLines.push({ text: `Chave Pix: ${pixKey}`, bold: true, color: rgb(0, 0, 0) })
    if (nomeBeneficiario) pagamentoLines.push({ text: `Beneficiário: ${nomeBeneficiario}`, bold: false, color: rgb(0, 0, 0) })
    
    if (telefoneFinanceiro && telefoneFinanceiro !== '-') {
      pagamentoLines.push({ text: `Comprovante: ${telefoneFinanceiro}`, bold: false, color: rgb(0, 0, 0) })
    }
    
    const wrappedPagamento: any[] = []
    // Deixar 120px para o QR Code na direita
    const textWidthLimits = qrBuffer ? pagamentoWidth - 130 : pagamentoWidth
    
    pagamentoLines.forEach((line) => {
      wrapText(line.text, textWidthLimits, 9, line.bold).forEach((part) => {
        wrappedPagamento.push({ text: part, bold: line.bold, color: line.color })
      })
    })

    const pagamentoHeight = Math.max(wrappedPagamento.length * 12 + 20, qrBuffer ? 120 : 60)
    
    page.drawRectangle({
      x: margin - 4,
      y: payTopY - pagamentoHeight,
      width: 4,
      height: pagamentoHeight,
      color: rgb(0.85, 0.7, 0.2),
    })

    let payY = payTopY - 12
    wrappedPagamento.forEach((line) => {
      drawText(line.text, margin + 6, payY, 9, line.bold, line.color)
      payY -= 12
    })
    
    // Desenhar QR Code
    if (qrBuffer) {
        const qrImage = await pdfDoc.embedPng(qrBuffer)
        const qrSize = 100
        page.drawImage(qrImage, {
            x: width - margin - qrSize - 10,
            y: payTopY - qrSize - 10,
            width: qrSize,
            height: qrSize
        })
        drawText('Pix Copia e Cola:', width - margin - qrSize - 10, payTopY - qrSize - 22, 8, true)
    }

    y = payTopY - pagamentoHeight - 20
    
    // Avisos Finais
    const avisos: any[] = []
    if (mensagemPagamento) avisos.push({ text: mensagemPagamento, bold: false })
    avisos.push({ text: 'IMPORTANTE: Atenção ao pagamento, deve ser realizado assim que receber o romaneio.', bold: true })
    avisos.push({ text: 'Caso o pagamento não seja realizado em até 24hs será removido do grupo.', bold: false })
    
    avisos.forEach(aviso => {
         wrapText(aviso.text, width - margin * 2, 9, aviso.bold).forEach(line => {
             drawText(line, margin, y, 9, aviso.bold, rgb(0.3, 0.3, 0.3))
             y -= 12
         })
    })

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
