/**
 * PaymentConfigService - Centralized Payment Configuration
 * 
 * Single Source of Truth for all payment settings.
 * Reads from integrations table only.
 */

import { supabase } from '../lib/supabase'

class PaymentConfigService {
  static instance = null
  
  constructor() {
    this.pixConfig = null
    this.mercadoPagoConfig = null
    this.loaded = false
  }
  
  static getInstance() {
    if (!PaymentConfigService.instance) {
      PaymentConfigService.instance = new PaymentConfigService()
    }
    return PaymentConfigService.instance
  }
  
  /**
   * Load payment configuration from integrations table
   */
  async loadConfig() {
    try {
      const { data: integrations, error } = await supabase
        .from('integrations')
        .select('type, config')
        .in('type', ['pix', 'mercadopago'])
      
      if (error) throw error
      
      integrations?.forEach(item => {
        if (item.type === 'pix') {
          this.pixConfig = item.config
        } else if (item.type === 'mercadopago') {
          this.mercadoPagoConfig = item.config
        }
      })
      
      this.loaded = true
      return true
    } catch (error) {
      console.error('Erro ao carregar configuração de pagamento:', error)
      return false
    }
  }
  
  /**
   * Check if PIX is configured
   */
  isPixConfigured() {
    return !!(this.pixConfig?.chave && this.pixConfig?.nome_beneficiario)
  }
  
  /**
   * Check if Mercado Pago is configured
   */
  isMercadoPagoConfigured() {
    return !!(this.mercadoPagoConfig?.access_token)
  }
  
  /**
   * Get PIX data for display
   */
  getPixData() {
    if (!this.pixConfig) return null
    
    return {
      chave: this.pixConfig.chave || '',
      nome_beneficiario: this.pixConfig.nome_beneficiario || '',
      cidade: this.pixConfig.cidade || ''
    }
  }
  
  /**
   * Get Mercado Pago data for payments
   */
  getMercadoPagoData() {
    if (!this.mercadoPagoConfig) return null
    
    return {
      public_key: this.mercadoPagoConfig.public_key || '',
      access_token: this.mercadoPagoConfig.access_token || '',
      pix: this.mercadoPagoConfig.pix || false,
      cartao: this.mercadoPagoConfig.cartao || false
    }
  }
  
  /**
   * Validate that payment can be processed
   * Throws error if not configured
   */
  validatePaymentConfig() {
    if (!this.loaded) {
      throw new Error('Configuração de pagamento não carregada. Recarregue a página.')
    }
    
    if (!this.isPixConfigured() && !this.isMercadoPagoConfigured()) {
      throw new Error('Nenhum método de pagamento configurado. Configure PIX ou Mercado Pago em Configurações > Integrações.')
    }
    
    return true
  }
  
  /**
   * Get formatted payment data for romaneio creation
   * This data is for display only - source of truth is integrations table
   */
  getFormattedPaymentData() {
    return {
      pix: this.isPixConfigured() ? {
        configurado: true,
        chave: this.pixConfig.chave,
        nome_beneficiario: this.pixConfig.nome_beneficiario,
        cidade: this.pixConfig.cidade
      } : { configurado: false },
      mercadopago: this.isMercadoPagoConfigured() ? {
        configurado: true,
        public_key: this.mercadoPagoConfig.public_key
      } : { configurado: false }
    }
  }
  
  /**
   * Generate PIX EMV code (BR Code)
   */
  generatePixCode(valor, txid = '') {
    if (!this.isPixConfigured()) return null
    
    const { chave, nome_beneficiario, cidade } = this.pixConfig
    
    // Simplified PIX EMV generation
    const payload = [
      '00', '02', '01',                              // Format Indicator
      '26', this.formatEMV('00', 'BR.GOV.BCB.PIX') + this.formatEMV('01', chave),
      '52', '04', '0000',                            // Merchant Category Code
      '53', '03', '986',                             // Currency (BRL)
      '54', String(valor.toFixed(2).length).padStart(2, '0'), valor.toFixed(2),
      '58', '02', 'BR',                              // Country
      '59', String(nome_beneficiario.length).padStart(2, '0'), nome_beneficiario.substring(0, 25),
      '60', String(cidade.length).padStart(2, '0'), cidade.substring(0, 15),
      '62', this.formatEMV('05', txid || `ROM${Date.now()}`.substring(0, 25))
    ].join('')
    
    // Add CRC16
    const crc = this.calculateCRC16(payload + '6304')
    return payload + '6304' + crc
  }
  
  formatEMV(id, value) {
    return id + String(value.length).padStart(2, '0') + value
  }
  
  calculateCRC16(str) {
    let crc = 0xFFFF
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8
      for (let j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1)
      }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0')
  }
}

// Export singleton instance
export const paymentConfig = PaymentConfigService.getInstance()
export default PaymentConfigService
