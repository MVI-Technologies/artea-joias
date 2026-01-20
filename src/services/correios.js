/**
 * Serviço de integração com API dos Correios
 */

const CORREIOS_TOKEN = import.meta.env.VITE_CORREIOS_TOKEN

// CEP de origem padrão (configurável)
const CEP_ORIGEM = '17800000' // Adamantina-SP (exemplo)

/**
 * Calcular frete pelos Correios
 * @param {string} cepDestino - CEP de destino
 * @param {Object} pacote - Dimensões e peso do pacote
 */
export async function calcularFrete(cepDestino, pacote = {}) {
  // Valores padrão para semijoias pequenas
  const {
    peso = 0.3, // kg
    comprimento = 16, // cm
    altura = 5, // cm
    largura = 11, // cm
    servicos = ['04014', '04510'] // SEDEX e PAC
  } = pacote

  if (!CORREIOS_TOKEN) {
    // Fallback: calcular frete estimado se API não configurada
    console.warn('Correios API não configurada, usando valores estimados')
    return calcularFreteEstimado(cepDestino)
  }

  try {
    const results = []

    for (const servico of servicos) {
      const params = new URLSearchParams({
        nCdServico: servico,
        sCepOrigem: CEP_ORIGEM.replace(/\D/g, ''),
        sCepDestino: cepDestino.replace(/\D/g, ''),
        nVlPeso: peso.toString(),
        nCdFormato: '1', // Caixa/Pacote
        nVlComprimento: comprimento.toString(),
        nVlAltura: altura.toString(),
        nVlLargura: largura.toString(),
        nVlDiametro: '0',
        sCdMaoPropria: 'N',
        nVlValorDeclarado: '0',
        sCdAvisoRecebimento: 'N'
      })

      const response = await fetch(
        `https://ws.correios.com.br/calculador/CalcPrecoPrazo.asmx/CalcPrecoPrazo?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${CORREIOS_TOKEN}`
          }
        }
      )

      if (response.ok) {
        const text = await response.text()
        const result = parseCorreiosResponse(text, servico)
        if (result) {
          results.push(result)
        }
      }
    }

    return {
      success: true,
      opcoes: results.sort((a, b) => a.valor - b.valor)
    }
  } catch (error) {
    console.error('Erro ao calcular frete:', error)
    return calcularFreteEstimado(cepDestino)
  }
}

/**
 * Calcular frete estimado (fallback)
 */
function calcularFreteEstimado(cepDestino) {
  // Obter região pelo CEP
  const regiao = getRegiaoPorCep(cepDestino)
  
  // Valores estimados por região
  const valores = {
    sudeste: { pac: 18.90, sedex: 28.90 },
    sul: { pac: 22.90, sedex: 35.90 },
    nordeste: { pac: 28.90, sedex: 45.90 },
    norte: { pac: 32.90, sedex: 52.90 },
    centro_oeste: { pac: 25.90, sedex: 40.90 }
  }

  const precos = valores[regiao] || valores.sudeste

  return {
    success: true,
    estimado: true,
    opcoes: [
      {
        servico: '04510',
        nome: 'PAC',
        valor: precos.pac,
        prazo: regiao === 'sudeste' ? '5-8 dias úteis' : '8-15 dias úteis'
      },
      {
        servico: '04014',
        nome: 'SEDEX',
        valor: precos.sedex,
        prazo: regiao === 'sudeste' ? '1-3 dias úteis' : '3-6 dias úteis'
      }
    ]
  }
}

/**
 * Identificar região pelo CEP
 */
function getRegiaoPorCep(cep) {
  const prefixo = parseInt(cep.replace(/\D/g, '').slice(0, 2))
  
  if (prefixo >= 1 && prefixo <= 39) return 'sudeste' // SP, RJ, ES, MG
  if (prefixo >= 40 && prefixo <= 65) return 'nordeste' // BA, SE, AL, PE, etc.
  if (prefixo >= 66 && prefixo <= 69) return 'norte' // PA, AM, etc.
  if (prefixo >= 70 && prefixo <= 79) return 'centro_oeste' // DF, GO, MT, MS
  if (prefixo >= 80 && prefixo <= 99) return 'sul' // PR, SC, RS
  
  return 'sudeste'
}

/**
 * Parse resposta XML dos Correios
 */
function parseCorreiosResponse(xml, servico) {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')
    
    const valor = doc.querySelector('Valor')?.textContent?.replace(',', '.')
    const prazo = doc.querySelector('PrazoEntrega')?.textContent
    const erro = doc.querySelector('Erro')?.textContent
    
    if (erro && erro !== '0') {
      return null
    }
    
    const nomes = {
      '04014': 'SEDEX',
      '04510': 'PAC',
      '40010': 'SEDEX',
      '41106': 'PAC'
    }
    
    return {
      servico,
      nome: nomes[servico] || servico,
      valor: parseFloat(valor) || 0,
      prazo: `${prazo} dias úteis`
    }
  } catch (e) {
    return null
  }
}

/**
 * Validar CEP
 */
export function validarCep(cep) {
  const cleaned = cep.replace(/\D/g, '')
  return cleaned.length === 8
}

/**
 * Formatar CEP
 */
export function formatarCep(cep) {
  const cleaned = cep.replace(/\D/g, '')
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`
  }
  return cleaned
}
