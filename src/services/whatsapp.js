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
