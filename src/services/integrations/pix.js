/**
 * PIX Integration Service
 * Geração de QR Code PIX estático e dinâmico
 */

class PixService {
  constructor(config) {
    this.chave = config.chave
    this.nomeBeneficiario = config.nome_beneficiario
    this.cidade = config.cidade
  }

  /**
   * Validar configuração
   */
  validate() {
    if (!this.chave) {
      return { valid: false, error: 'Chave PIX não informada' }
    }
    if (!this.nomeBeneficiario) {
      return { valid: false, error: 'Nome do beneficiário não informado' }
    }
    if (!this.cidade) {
      return { valid: false, error: 'Cidade não informada' }
    }
    return { valid: true }
  }

  /**
   * Gerar payload PIX (formato EMV)
   */
  generatePayload(valor, txid = '') {
    const formatField = (id, value) => {
      const len = value.length.toString().padStart(2, '0')
      return `${id}${len}${value}`
    }

    // Merchant Account Information (chave PIX)
    const gui = formatField('00', 'br.gov.bcb.pix')
    const chaveFormatada = formatField('01', this.chave)
    const merchantAccount = formatField('26', gui + chaveFormatada)

    // Campos principais
    const payloadFormat = formatField('00', '01')
    const merchantCategoryCode = formatField('52', '0000')
    const transactionCurrency = formatField('53', '986') // BRL
    
    // Valor (se informado)
    const transactionAmount = valor ? formatField('54', valor.toFixed(2)) : ''
    
    // País
    const countryCode = formatField('58', 'BR')
    
    // Nome do beneficiário (máx 25 caracteres)
    const nomeFormatado = this.nomeBeneficiario
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .substring(0, 25)
      .toUpperCase()
    const merchantName = formatField('59', nomeFormatado)
    
    // Cidade (máx 15 caracteres)
    const cidadeFormatada = this.cidade
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .substring(0, 15)
      .toUpperCase()
    const merchantCity = formatField('60', cidadeFormatada)

    // Transaction ID (opcional)
    const txidFormatado = txid ? formatField('05', txid.substring(0, 25)) : formatField('05', '***')
    const additionalData = formatField('62', txidFormatado)

    // Montar payload sem CRC
    const payloadSemCRC = 
      payloadFormat +
      merchantAccount +
      merchantCategoryCode +
      transactionCurrency +
      transactionAmount +
      countryCode +
      merchantName +
      merchantCity +
      additionalData +
      '6304' // ID do CRC

    // Calcular CRC16
    const crc = this.calculateCRC16(payloadSemCRC)
    
    return payloadSemCRC + crc
  }

  /**
   * Calcular CRC16 CCITT-FALSE
   */
  calculateCRC16(payload) {
    const polynomial = 0x1021
    let crc = 0xFFFF

    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8
      for (let j = 0; j < 8; j++) {
        if (crc & 0x8000) {
          crc = (crc << 1) ^ polynomial
        } else {
          crc <<= 1
        }
        crc &= 0xFFFF
      }
    }

    return crc.toString(16).toUpperCase().padStart(4, '0')
  }

  /**
   * Gerar QR Code como Data URL
   */
  async generateQRCode(valor, txid = '') {
    const validation = this.validate()
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    const payload = this.generatePayload(valor, txid)

    // Usar biblioteca QRCode ou API externa
    try {
      // Usar API do Google Charts para gerar QR Code
      const qrUrl = `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(payload)}&choe=UTF-8`
      
      return {
        success: true,
        payload,
        qrCodeUrl: qrUrl,
        valor,
        beneficiario: this.nomeBeneficiario,
        chave: this.chave,
        cidade: this.cidade,
        txid
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Gerar link de copia e cola
   */
  generateCopyPaste(valor, txid = '') {
    const validation = this.validate()
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    const payload = this.generatePayload(valor, txid)
    
    return {
      success: true,
      payload,
      valor,
      beneficiario: this.nomeBeneficiario
    }
  }
}

export default PixService

/**
 * Criar instância do serviço a partir das configurações salvas
 */
export async function getPixService(supabase) {
  try {
    const { data, error } = await supabase
      .from('integrations')
      .select('config')
      .eq('type', 'pix')
      .single()

    if (error || !data) {
      return null
    }

    if (!data.config.chave) {
      return null
    }

    return new PixService(data.config)
  } catch (error) {
    console.error('Erro ao carregar configuração PIX:', error)
    return null
  }
}
