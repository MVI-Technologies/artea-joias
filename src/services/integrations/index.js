/**
 * Central de Integrações
 * Exporta todos os serviços de integração disponíveis
 */

export { default as MercadoPagoService, getMercadoPagoService } from './mercadopago'
export { default as CorreiosService, getCorreiosService } from './correios'
export { default as PixService, getPixService } from './pix'

/**
 * Carregar todas as integrações configuradas
 */
export async function loadIntegrations(supabase) {
  const integrations = {
    mercadopago: null,
    correios: null,
    pix: null
  }

  try {
    const { data, error } = await supabase
      .from('integrations')
      .select('type, config')

    if (error) {
      console.error('Erro ao carregar integrações:', error)
      return integrations
    }

    for (const item of data || []) {
      if (item.type === 'mercadopago' && item.config?.access_token) {
        const { default: MercadoPagoService } = await import('./mercadopago')
        integrations.mercadopago = new MercadoPagoService(
          item.config.access_token,
          item.config.public_key
        )
      }

      if (item.type === 'correios' && item.config?.usuario) {
        const { default: CorreiosService } = await import('./correios')
        integrations.correios = new CorreiosService(item.config)
      }

      if (item.type === 'pix' && item.config?.chave) {
        const { default: PixService } = await import('./pix')
        integrations.pix = new PixService(item.config)
      }
    }

    return integrations
  } catch (error) {
    console.error('Erro ao carregar integrações:', error)
    return integrations
  }
}

/**
 * Verificar status de todas as integrações
 */
export async function checkIntegrationsStatus(supabase) {
  const status = {
    mercadopago: { configured: false, valid: false },
    correios: { configured: false, valid: false },
    pix: { configured: false, valid: false }
  }

  try {
    const { data } = await supabase
      .from('integrations')
      .select('type, config')

    for (const item of data || []) {
      if (item.type === 'mercadopago') {
        status.mercadopago.configured = !!item.config?.access_token
        if (status.mercadopago.configured) {
          const { default: MercadoPagoService } = await import('./mercadopago')
          const service = new MercadoPagoService(item.config.access_token, item.config.public_key)
          const result = await service.validateCredentials()
          status.mercadopago.valid = result.valid
          status.mercadopago.user = result.user
        }
      }

      if (item.type === 'correios') {
        status.correios.configured = !!(item.config?.usuario && item.config?.chave_acesso)
        if (status.correios.configured) {
          const { default: CorreiosService } = await import('./correios')
          const service = new CorreiosService(item.config)
          const result = await service.validateCredentials()
          status.correios.valid = result.valid
        }
      }

      if (item.type === 'pix') {
        status.pix.configured = !!item.config?.chave
        if (status.pix.configured) {
          const { default: PixService } = await import('./pix')
          const service = new PixService(item.config)
          const result = service.validate()
          status.pix.valid = result.valid
        }
      }
    }

    return status
  } catch (error) {
    console.error('Erro ao verificar status das integrações:', error)
    return status
  }
}
