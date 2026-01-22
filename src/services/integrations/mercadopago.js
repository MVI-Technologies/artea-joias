/**
 * Mercado Pago Integration Service
 * Documentação: https://www.mercadopago.com.br/developers/pt/docs
 */

class MercadoPagoService {
  constructor(accessToken, publicKey) {
    this.accessToken = accessToken
    this.publicKey = publicKey
    this.baseUrl = 'https://api.mercadopago.com'
  }

  /**
   * Validar credenciais do Mercado Pago
   */
  async validateCredentials() {
    try {
      const response = await fetch(`${this.baseUrl}/users/me`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      })

      if (!response.ok) {
        throw new Error('Credenciais inválidas')
      }

      const data = await response.json()
      return {
        valid: true,
        user: {
          id: data.id,
          email: data.email,
          nickname: data.nickname
        }
      }
    } catch (error) {
      return {
        valid: false,
        error: error.message
      }
    }
  }

  /**
   * Criar preferência de pagamento (Checkout Pro)
   */
  async createPreference(orderData) {
    try {
      const preference = {
        items: orderData.items.map(item => ({
          id: item.id,
          title: item.name,
          description: item.description || '',
          picture_url: item.image || '',
          quantity: item.quantity,
          currency_id: 'BRL',
          unit_price: parseFloat(item.price)
        })),
        payer: {
          name: orderData.customer.name,
          email: orderData.customer.email,
          phone: {
            number: orderData.customer.phone
          }
        },
        back_urls: {
          success: orderData.successUrl || `${window.location.origin}/cliente/pedidos?status=success`,
          failure: orderData.failureUrl || `${window.location.origin}/cliente/pedidos?status=failure`,
          pending: orderData.pendingUrl || `${window.location.origin}/cliente/pedidos?status=pending`
        },
        auto_return: 'approved',
        external_reference: orderData.orderId,
        notification_url: orderData.webhookUrl,
        payment_methods: {
          excluded_payment_types: orderData.excludedTypes || [],
          installments: orderData.maxInstallments || 12
        }
      }

      const response = await fetch(`${this.baseUrl}/checkout/preferences`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preference)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erro ao criar preferência')
      }

      const data = await response.json()
      return {
        success: true,
        preferenceId: data.id,
        initPoint: data.init_point,
        sandboxInitPoint: data.sandbox_init_point
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Criar pagamento PIX
   */
  async createPixPayment(paymentData) {
    try {
      const payment = {
        transaction_amount: parseFloat(paymentData.amount),
        description: paymentData.description,
        payment_method_id: 'pix',
        payer: {
          email: paymentData.email,
          first_name: paymentData.name?.split(' ')[0] || '',
          last_name: paymentData.name?.split(' ').slice(1).join(' ') || '',
          identification: {
            type: 'CPF',
            number: paymentData.cpf?.replace(/\D/g, '') || ''
          }
        },
        external_reference: paymentData.orderId
      }

      const response = await fetch(`${this.baseUrl}/v1/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `${paymentData.orderId}-${Date.now()}`
        },
        body: JSON.stringify(payment)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erro ao criar pagamento PIX')
      }

      const data = await response.json()
      return {
        success: true,
        paymentId: data.id,
        status: data.status,
        qrCode: data.point_of_interaction?.transaction_data?.qr_code,
        qrCodeBase64: data.point_of_interaction?.transaction_data?.qr_code_base64,
        ticketUrl: data.point_of_interaction?.transaction_data?.ticket_url,
        expirationDate: data.date_of_expiration
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Consultar status do pagamento
   */
  async getPaymentStatus(paymentId) {
    try {
      const response = await fetch(`${this.baseUrl}/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      })

      if (!response.ok) {
        throw new Error('Pagamento não encontrado')
      }

      const data = await response.json()
      return {
        success: true,
        id: data.id,
        status: data.status,
        statusDetail: data.status_detail,
        amount: data.transaction_amount,
        paidAmount: data.transaction_details?.total_paid_amount,
        dateApproved: data.date_approved,
        paymentMethod: data.payment_method_id,
        externalReference: data.external_reference
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Processar webhook de notificação
   */
  async processWebhook(data) {
    if (data.type === 'payment') {
      return await this.getPaymentStatus(data.data.id)
    }
    return { success: false, error: 'Tipo de notificação não suportado' }
  }
}

export default MercadoPagoService

/**
 * Criar instância do serviço a partir das configurações salvas
 */
export async function getMercadoPagoService(supabase) {
  try {
    const { data, error } = await supabase
      .from('integrations')
      .select('config')
      .eq('type', 'mercadopago')
      .single()

    if (error || !data) {
      return null
    }

    const { access_token, public_key } = data.config
    if (!access_token) {
      return null
    }

    return new MercadoPagoService(access_token, public_key)
  } catch (error) {
    console.error('Erro ao carregar configuração do Mercado Pago:', error)
    return null
  }
}
