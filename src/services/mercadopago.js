/**
 * Serviço de integração com Mercado Pago
 */

const MERCADO_PAGO_ACCESS_TOKEN = import.meta.env.VITE_MERCADOPAGO_ACCESS_TOKEN

/**
 * Criar preferência de pagamento (Link de pagamento)
 * @param {Object} order - Dados do pedido
 * @param {Object} client - Dados do cliente
 */
export async function createPaymentPreference(order, client, product) {
  if (!MERCADO_PAGO_ACCESS_TOKEN) {
    console.warn('Mercado Pago não configurado')
    return { success: false, error: 'API não configurada' }
  }

  try {
    const preference = {
      items: [
        {
          id: order.id,
          title: product.nome,
          description: `Pedido #${order.id?.slice(-6)}`,
          quantity: order.quantidade,
          currency_id: 'BRL',
          unit_price: order.valor_unitario
        }
      ],
      payer: {
        name: client.nome,
        email: client.email || 'cliente@artea.local',
        phone: {
          number: client.telefone?.replace(/\D/g, '')
        }
      },
      external_reference: order.id,
      back_urls: {
        success: `${window.location.origin}/pagamento/sucesso`,
        pending: `${window.location.origin}/pagamento/pendente`,
        failure: `${window.location.origin}/pagamento/erro`
      },
      auto_return: 'approved',
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 1
      },
      notification_url: `${import.meta.env.VITE_API_URL || ''}/api/webhooks/mercadopago`
    }

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`
      },
      body: JSON.stringify(preference)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao criar preferência')
    }

    return {
      success: true,
      preferenceId: data.id,
      initPoint: data.init_point, // URL do checkout
      sandboxInitPoint: data.sandbox_init_point
    }
  } catch (error) {
    console.error('Erro ao criar preferência Mercado Pago:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Gerar QR Code PIX
 * @param {Object} order - Dados do pedido
 */
export async function generatePixPayment(order, client) {
  if (!MERCADO_PAGO_ACCESS_TOKEN) {
    console.warn('Mercado Pago não configurado')
    return { success: false, error: 'API não configurada' }
  }

  try {
    const payment = {
      transaction_amount: order.valor_total,
      description: `Pedido #${order.id?.slice(-6)} - Artea Joias`,
      payment_method_id: 'pix',
      payer: {
        email: client.email || 'cliente@artea.local',
        first_name: client.nome?.split(' ')[0],
        last_name: client.nome?.split(' ').slice(1).join(' ') || ''
      },
      external_reference: order.id
    }

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
        'X-Idempotency-Key': order.id
      },
      body: JSON.stringify(payment)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao gerar PIX')
    }

    return {
      success: true,
      paymentId: data.id,
      pixCopiaECola: data.point_of_interaction?.transaction_data?.qr_code,
      pixQrCode: data.point_of_interaction?.transaction_data?.qr_code_base64,
      expirationDate: data.date_of_expiration
    }
  } catch (error) {
    console.error('Erro ao gerar PIX:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Verificar status do pagamento
 * @param {string} paymentId - ID do pagamento
 */
export async function checkPaymentStatus(paymentId) {
  if (!MERCADO_PAGO_ACCESS_TOKEN) {
    return { success: false, error: 'API não configurada' }
  }

  try {
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao verificar pagamento')
    }

    return {
      success: true,
      status: data.status, // approved, pending, rejected, etc.
      statusDetail: data.status_detail,
      externalReference: data.external_reference
    }
  } catch (error) {
    console.error('Erro ao verificar pagamento:', error)
    return { success: false, error: error.message }
  }
}
