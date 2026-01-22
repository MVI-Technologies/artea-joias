import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import MercadoPagoService from '../services/integrations/mercadopago'
import CorreiosService from '../services/integrations/correios'
import PixService from '../services/integrations/pix'

/**
 * Hook para acessar os serviços de integração
 */
export function useIntegrations() {
  const [services, setServices] = useState({
    mercadopago: null,
    correios: null,
    pix: null
  })
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState({
    mercadopago: false,
    correios: false,
    pix: false
  })

  const loadIntegrations = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('type, config')

      if (error) {
        console.error('Erro ao carregar integrações:', error)
        return
      }

      const newServices = { mercadopago: null, correios: null, pix: null }
      const newConfigured = { mercadopago: false, correios: false, pix: false }

      for (const item of data || []) {
        if (item.type === 'mercadopago' && item.config?.access_token) {
          newServices.mercadopago = new MercadoPagoService(
            item.config.access_token,
            item.config.public_key
          )
          newServices.mercadopago.config = item.config
          newConfigured.mercadopago = true
        }

        if (item.type === 'correios' && item.config?.usuario) {
          newServices.correios = new CorreiosService(item.config)
          newConfigured.correios = true
        }

        if (item.type === 'pix' && item.config?.chave) {
          newServices.pix = new PixService(item.config)
          newConfigured.pix = true
        }
      }

      setServices(newServices)
      setConfigured(newConfigured)
    } catch (error) {
      console.error('Erro ao carregar integrações:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadIntegrations()
  }, [loadIntegrations])

  return {
    services,
    configured,
    loading,
    reload: loadIntegrations,
    
    // Atalhos para os serviços
    mercadopago: services.mercadopago,
    correios: services.correios,
    pix: services.pix,
    
    // Verificar se uma integração está configurada
    isConfigured: (type) => configured[type] || false
  }
}

/**
 * Hook específico para Mercado Pago
 */
export function useMercadoPago() {
  const { mercadopago, configured, loading, reload } = useIntegrations()
  
  return {
    service: mercadopago,
    isConfigured: configured.mercadopago,
    loading,
    reload,
    
    // Métodos diretos
    createPreference: async (orderData) => {
      if (!mercadopago) throw new Error('Mercado Pago não configurado')
      return mercadopago.createPreference(orderData)
    },
    createPixPayment: async (paymentData) => {
      if (!mercadopago) throw new Error('Mercado Pago não configurado')
      return mercadopago.createPixPayment(paymentData)
    },
    getPaymentStatus: async (paymentId) => {
      if (!mercadopago) throw new Error('Mercado Pago não configurado')
      return mercadopago.getPaymentStatus(paymentId)
    }
  }
}

/**
 * Hook específico para Correios
 */
export function useCorreios() {
  const { correios, configured, loading, reload } = useIntegrations()
  
  return {
    service: correios,
    isConfigured: configured.correios,
    loading,
    reload,
    
    // Métodos diretos
    calcularFrete: async (cepDestino, peso, dimensoes) => {
      if (!correios) throw new Error('Correios não configurado')
      return correios.calcularFrete(cepDestino, peso, dimensoes)
    },
    consultarCep: async (cep) => {
      if (!correios) {
        // Fallback para ViaCEP sem integração
        const response = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g, '')}/json/`)
        const data = await response.json()
        if (data.erro) throw new Error('CEP não encontrado')
        return {
          success: true,
          endereco: {
            cep: data.cep,
            logradouro: data.logradouro,
            complemento: data.complemento,
            bairro: data.bairro,
            cidade: data.localidade,
            estado: data.uf
          }
        }
      }
      return correios.consultarCep(cep)
    },
    rastrear: async (codigoRastreio) => {
      if (!correios) throw new Error('Correios não configurado')
      return correios.rastrear(codigoRastreio)
    }
  }
}

/**
 * Hook específico para PIX
 */
export function usePix() {
  const { pix, configured, loading, reload } = useIntegrations()
  
  return {
    service: pix,
    isConfigured: configured.pix,
    loading,
    reload,
    
    // Métodos diretos
    generateQRCode: async (valor, txid) => {
      if (!pix) throw new Error('PIX não configurado')
      return pix.generateQRCode(valor, txid)
    },
    generateCopyPaste: (valor, txid) => {
      if (!pix) throw new Error('PIX não configurado')
      return pix.generateCopyPaste(valor, txid)
    }
  }
}

export default useIntegrations
