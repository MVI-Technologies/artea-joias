/**
 * Serviço de integração com Evolution API (WhatsApp)
 */

const EVOLUTION_API_URL = import.meta.env.VITE_EVOLUTION_API_URL
const EVOLUTION_API_TOKEN = import.meta.env.VITE_EVOLUTION_API_TOKEN

/**
 * Enviar mensagem de texto via WhatsApp
 * @param {string} to - Número do destinatário (com DDD)
 * @param {string} message - Mensagem a enviar
 */
export async function sendWhatsAppMessage(to, message) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
    console.warn('Evolution API não configurada')
    return { success: false, error: 'API não configurada' }
  }

  try {
    // Formatar número (remover caracteres não numéricos e adicionar código do país)
    const formattedNumber = formatPhoneNumber(to)
    
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/artea`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_TOKEN
      },
      body: JSON.stringify({
        number: formattedNumber,
        text: message
      })
    })

    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.message || 'Erro ao enviar mensagem')
    }

    return { success: true, data }
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error)
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

  const results = []
  for (const client of clients) {
    const result = await sendWhatsAppMessage(client.telefone, message)
    results.push({ client: client.nome, ...result })
  }
  
  return results
}

/**
 * Notificar fechamento de lote
 */
export async function notifyLotClosed(lot, clients) {
  const message = `✅ *Lote Fechado!*

📦 *${lot.nome}*

O lote foi fechado com sucesso! Em breve você receberá informações sobre o pagamento.

_Artea Joias - Compras Coletivas_`

  const results = []
  for (const client of clients) {
    const result = await sendWhatsAppMessage(client.telefone, message)
    results.push({ client: client.nome, ...result })
  }
  
  return results
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
 * Formatar número de telefone para padrão internacional
 */
function formatPhoneNumber(phone) {
  // Remover caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '')
  
  // Se não começar com 55 (Brasil), adicionar
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned
  }
  
  return cleaned
}
