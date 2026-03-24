import { generateRomaneioPDF } from '../utils/pdfGenerator'

/**
 * Serviço de integração com WhatsApp via Supabase Edge Function
 * A Edge Function faz a comunicação segura com a Evolution API
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Enviar mensagem de texto via WhatsApp (individual)
 * @param {string} to - Número do destinatário (com DDD)
 * @param {string} message - Mensagem a enviar
 */
export async function sendWhatsAppMessage(to, message) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp?action=single`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        to,
        message
      })
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Erro ao enviar mensagem')
    }

    return { success: true, data: data.data }
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Enviar mensagem em massa para múltiplos destinatários
 * @param {Array<{telefone: string, nome: string}>} recipients - Lista de destinatários
 * @param {string} message - Mensagem a enviar (suporta variável %Nome%)
 */
export async function sendBulkWhatsAppMessage(recipients, message) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp?action=bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        recipients,
        message
      })
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Erro ao enviar mensagens')
    }

    return { success: true, data: data.data }
  } catch (error) {
    console.error('Erro ao enviar WhatsApp em massa:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Enviar imagem em massa para múltiplos destinatários via Evolution API
 * @param {Array<{telefone: string, nome: string}>} recipients - Lista de destinatários
 * @param {string} imageUrl - URL pública da imagem a enviar
 * @param {string} caption - Legenda da imagem (suporta variável %Nome%)
 */
export async function sendBulkImageMessage(recipients, imageUrl, caption) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp?action=bulkImage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        recipients,
        imageUrl,
        caption
      })
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Erro ao enviar imagens em massa')
    }

    return { success: true, data: data.data }
  } catch (error) {
    console.error('Erro ao enviar imagens em massa via WhatsApp:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Notificar abertura de novo lote
 */
export async function notifyLotOpened(lot, clients) {
  const message = `🎉 *Novo Lote Disponível!*

📦 *${lot.nome}*

${lot.descricao || ''}

🔗 Acesse agora: ${lot.link_compra}

⏰ Válido até: ${lot.data_fim ? new Date(lot.data_fim).toLocaleDateString('pt-BR') : 'Em aberto'}

_Artea Joias - Compras Coletivas_`

  const recipients = clients.map(c => ({ telefone: c.telefone, nome: c.nome }))
  return sendBulkWhatsAppMessage(recipients, message)
}

/**
 * Notificar fechamento de lote
 */
export async function notifyLotClosed(lot, clients) {
  const message = `✅ *Lote Fechado!*

📦 *${lot.nome}*

O lote foi fechado com sucesso! Em breve você receberá informações sobre o pagamento.

_Artea Joias - Compras Coletivas_`

  const recipients = clients.map(c => ({ telefone: c.telefone, nome: c.nome }))
  return sendBulkWhatsAppMessage(recipients, message)
}

/**
 * Notificar confirmação de pagamento
 */
export async function notifyPaymentConfirmed(order, client) {
  const message = `💚 *Pagamento Confirmado!*

Olá ${client.nome}!

Seu pagamento foi confirmado com sucesso.

📦 Pedido: #${order.id?.slice(-6)}
💰 Valor: R$ ${order.valor_total?.toFixed(2)}

Em breve seu pedido será preparado e enviado.

_Artea Joias - Compras Coletivas_`

  return sendWhatsAppMessage(client.telefone, message)
}

/**
 * Notificar envio do pedido
 */
export async function notifyOrderShipped(order, client) {
  const message = `📦 *Pedido Enviado!*

Olá ${client.nome}!

Seu pedido foi enviado!

🏷️ Pedido: #${order.id?.slice(-6)}
${order.codigo_rastreio ? `📍 Rastreio: ${order.codigo_rastreio}` : ''}

_Artea Joias - Compras Coletivas_`

  return sendWhatsAppMessage(client.telefone, message)
}

/**
 * Notificar clientes sobre novo catálogo/link de vendas
 * @param {Object} catalog - Dados do catálogo criado
 * @param {Array} clients - Lista de clientes para notificar
 * @param {string} catalogUrl - URL do catálogo
 */
export async function notifyNewCatalog(catalog, clients, catalogUrl) {
  // Gerar número do link baseado no ID ou criar sequencial
  const linkNumber = catalog.numero_link || catalog.id?.slice(-4).toUpperCase() || Date.now().toString().slice(-4)
  const nomeLink = catalog.nome || 'Semijóias de Luxo no Precinho'

  const message = `🎉 *Novo Link Disponível!*

*LINK ${linkNumber} - ${nomeLink}*

${catalog.descricao || 'Acabamos de lançar um link repleto de novidades para você. As peças estão incríveis e escolhidas com muito amor.'}

🔗 Confira no link abaixo:
${catalogUrl}

⏰ Não perca tempo! Garante já suas peças favoritas.

_Att, Equipe ARTEA JOIAS_`

  const recipients = clients.map(c => ({ telefone: c.telefone, nome: c.nome }))

  // Se o catálogo tiver imagem de capa, envia como IMAGEM com legenda.
  // Isso garante que a foto apareça no WhatsApp independente de scraping de Open Graph.
  // Se não houver capa, envia como texto simples (o próprio WhatsApp tentará gerar preview do link).
  if (catalog.cover_image_url) {
    return sendBulkImageMessage(recipients, catalog.cover_image_url, message)
  }

  return sendBulkWhatsAppMessage(recipients, message)
}

/**
 * Notificar clientes sobre fechamento de catálogo/link de vendas
 * @param {Object} catalog - Dados do catálogo fechado
 * @param {Array} clients - Lista de clientes para notificar
 */
export async function notifyCatalogClosed(catalog, clients) {
  const linkNumber = catalog.numero_link || catalog.id?.slice(-4).toUpperCase() || ''

  const message = `Olá, %Nome%

O *LINK ${linkNumber}* - ${catalog.nome || 'Catálogo'} foi *FECHADO*! 🔒

Agradecemos por participar! Em breve você receberá informações sobre pagamento e envio do seu pedido.

Caso tenha alguma dúvida, entre em contato conosco.

Att, Equipe ARTEA JOIAS

_Mensagem automática_`

  const recipients = clients.map(c => ({ telefone: c.telefone, nome: c.nome }))
  return sendBulkWhatsAppMessage(recipients, message)
}

/**
 * Enviar arquivo/PDF via WhatsApp
 * @param {string} to - Número do destinatário (com DDD)
 * @param {string} fileBase64 - Arquivo em base64
 * @param {string} fileName - Nome do arquivo
 * @param {string} caption - Legenda opcional
 * @param {string} mimeType - Tipo MIME (default: application/pdf)
 */
export async function sendWhatsAppFile(to, fileBase64, fileName, caption = '', mimeType = 'application/pdf') {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp?action=file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        to,
        fileBase64,
        fileName,
        caption,
        mimeType
      })
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Erro ao enviar arquivo')
    }

    return { success: true, data: data.data }
  } catch (error) {
    console.error('Erro ao enviar arquivo via WhatsApp:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Enviar romaneios automaticamente para todos os clientes de um lote
 * @param {Object} supabase - Cliente Supabase autenticado
 * @param {string} lotId - ID do lote
 * @param {Object} lot - Dados do lote (para nome)
 * @returns {Promise<{success: boolean, sent: number, errors: number, details: Array}>}
 */
export async function sendRomaneiosAutomaticamente(supabase, lotId, lot) {
  try {
    // 1. Buscar configurações necessárias (Company e PIX)
    const { data: company } = await supabase
      .from('company_settings')
      .select('*')
      .single()

    const { data: pixInt } = await supabase
      .from('integrations')
      .select('config')
      .eq('type', 'pix')
      .single()

    const pixConfig = pixInt?.config || null

    // 2. Buscar todos os romaneios do lote com dados completos (cliente e itens)
    const { data: romaneios, error: romaneiosError } = await supabase
      .from('romaneios')
      .select(`
        *,
        client:clients(
          id,
          nome,
          telefone,
          cpf,
          email
        ),
        items:romaneio_items(
            *,
            product:products(
                *,
                category:categories(nome)
            )
        )
      `)
      .eq('lot_id', lotId)

    if (romaneiosError) {
      throw new Error(`Erro ao buscar romaneios: ${romaneiosError.message}`)
    }

    if (!romaneios || romaneios.length === 0) {
      return {
        success: true,
        sent: 0,
        errors: 0,
        details: [],
        message: 'Nenhum romaneio encontrado para este lote'
      }
    }

    const results = {
      sent: 0,
      errors: 0,
      details: []
    }

    // 3. Para cada romaneio, gerar PDF localmente e enviar
    for (const romaneio of romaneios) {
      const client = romaneio.client

      // Verificar se cliente tem telefone
      if (!client?.telefone) {
        results.errors++
        results.details.push({
          romaneioId: romaneio.id,
          clientName: client?.nome || 'Cliente desconhecido',
          success: false,
          error: 'Cliente não possui telefone cadastrado'
        })
        continue
      }

      try {
        // 3.1. Gerar PDF do romaneio LOCALMENTE
        const fileBase64 = await generateRomaneioPDF({
          romaneio,
          lot,
          client,
          items: romaneio.items || [],
          company,
          pixConfig
        })

        if (!fileBase64) {
          throw new Error('Falha ao gerar PDF (conteúdo vazio)')
        }

        // 3.2. Preparar mensagem
        const fileName = `Romaneio-${romaneio.numero_romaneio || romaneio.id.slice(-6)}.pdf`

        // Personalizar mensagem
        const firstName = client.nome ? client.nome.split(' ')[0] : 'Cliente'
        const caption = `📄 *Seu Pedido Chegou!*
        
Olá ${firstName}! 

Seu romaneio do grupo *${lot.nome}* já está pronto.
        
Confira no PDF anexo todos os detalhes dos seus produtos e as informações para pagamento.

*Importante:* O pagamento deve ser realizado em até 24h.

Dúvidas? Estamos à disposição.

Att, ${company?.nome_empresa || 'Artea Joias'}`

        // 3.3. Enviar via WhatsApp
        const sendResult = await sendWhatsAppFile(
          client.telefone,
          fileBase64,
          fileName,
          caption
        )

        if (sendResult.success) {
          results.sent++
          results.details.push({
            romaneioId: romaneio.id,
            clientName: client.nome,
            success: true
          })
        } else {
          results.errors++
          results.details.push({
            romaneioId: romaneio.id,
            clientName: client.nome,
            success: false,
            error: sendResult.error
          })
        }

        // Delay entre envios para evitar rate limiting (2s)
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error) {
        console.error(`Erro ao processar romaneio ${romaneio.id}:`, error)
        results.errors++
        results.details.push({
          romaneioId: romaneio.id,
          clientName: client?.nome || 'Cliente desconhecido',
          success: false,
          error: error.message || 'Erro desconhecido'
        })
      }
    }

    return {
      success: results.errors === 0,
      sent: results.sent,
      errors: results.errors,
      total: romaneios.length,
      details: results.details
    }

  } catch (error) {
    console.error('Erro ao enviar romaneios automaticamente:', error)
    return {
      success: false,
      sent: 0,
      errors: 0,
      details: [],
      error: error.message
    }
  }
}

/**
 * Enviar arquivo/PDF via WhatsApp
 * (This is an example implementation using the sendImageMessage format requested)
 * @param {Object} params
 * @param {string} params.number - Recipient phone number in international format
 * @param {string} params.imageUrl - Image URL (or base64) to send
 * @param {string} params.caption - Formatted message text
 */
export async function sendImageMessage({ number, imageUrl, caption }) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-whatsapp?action=sendImage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        number,
        media: imageUrl,
        mediatype: 'image',
        mimetype: 'image/jpeg',
        caption
      })
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Erro ao enviar imagem')
    }

    return { success: true, data: data.data }
  } catch (error) {
    console.error('Erro ao enviar imagem via WhatsApp:', error)
    return { success: false, error: error.message }
  }
}