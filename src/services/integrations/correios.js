/**
 * Correios Integration Service
 * API CWS dos Correios: https://cws.correios.com.br/
 */

class CorreiosService {
  constructor(config) {
    this.usuario = config.usuario
    this.chaveAcesso = config.chave_acesso
    this.contrato = config.contrato
    this.unidadeGestora = config.unidade_gestora
    this.cartaoPostagem = config.cartao_postagem
    this.remetente = {
      nome: config.nome_remetente,
      endereco: config.endereco,
      numero: config.numero,
      complemento: config.complemento,
      bairro: config.bairro,
      cidade: config.cidade,
      estado: config.estado,
      cep: config.cep?.replace(/\D/g, '')
    }
    this.tamanhoCaixa = config.tamanho_caixa?.split(',').map(Number) || [6, 12, 17]
    this.tipo = config.tipo || 'pac_sedex'
    
    this.baseUrl = 'https://api.correios.com.br'
    this.token = null
    this.tokenExpiry = null
  }

  /**
   * Autenticar na API dos Correios
   */
  async authenticate() {
    // Se token ainda é válido, retornar
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token
    }

    try {
      const response = await fetch(`${this.baseUrl}/token/v1/autentica/cartaopostagem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${this.usuario}:${this.chaveAcesso}`)}`
        },
        body: JSON.stringify({
          numero: this.cartaoPostagem
        })
      })

      if (!response.ok) {
        throw new Error('Falha na autenticação com os Correios')
      }

      const data = await response.json()
      this.token = data.token
      // Token válido por 1 hora
      this.tokenExpiry = new Date(Date.now() + 55 * 60 * 1000)
      
      return this.token
    } catch (error) {
      console.error('Erro na autenticação Correios:', error)
      throw error
    }
  }

  /**
   * Validar credenciais
   */
  async validateCredentials() {
    try {
      await this.authenticate()
      return {
        valid: true,
        message: 'Credenciais válidas'
      }
    } catch (error) {
      return {
        valid: false,
        error: error.message
      }
    }
  }

  /**
   * Calcular frete
   */
  async calcularFrete(cepDestino, peso, dimensoes = null) {
    try {
      await this.authenticate()

      const dims = dimensoes || {
        altura: this.tamanhoCaixa[0],
        largura: this.tamanhoCaixa[1],
        comprimento: this.tamanhoCaixa[2]
      }

      // Códigos dos serviços
      const servicos = []
      if (this.tipo === 'pac' || this.tipo === 'pac_sedex') {
        servicos.push('04510') // PAC
      }
      if (this.tipo === 'sedex' || this.tipo === 'pac_sedex') {
        servicos.push('04014') // SEDEX
      }

      const results = []

      for (const servico of servicos) {
        try {
          const response = await fetch(`${this.baseUrl}/preco/v1/nacional/${servico}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({
              cepOrigem: this.remetente.cep,
              cepDestino: cepDestino.replace(/\D/g, ''),
              psObjeto: peso.toString(),
              tpObjeto: '2', // Pacote
              comprimento: dims.comprimento.toString(),
              largura: dims.largura.toString(),
              altura: dims.altura.toString(),
              nuContrato: this.contrato,
              nuDR: this.unidadeGestora
            })
          })

          if (response.ok) {
            const data = await response.json()
            results.push({
              servico: servico === '04510' ? 'PAC' : 'SEDEX',
              codigo: servico,
              valor: parseFloat(data.pcFinal || data.pcBase || 0),
              prazo: parseInt(data.prazoEntrega || 0),
              erro: null
            })
          }
        } catch (err) {
          console.error(`Erro ao calcular ${servico}:`, err)
        }
      }

      return {
        success: results.length > 0,
        opcoes: results,
        origem: this.remetente.cep,
        destino: cepDestino
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Consultar CEP
   */
  async consultarCep(cep) {
    try {
      // Usar API pública ViaCEP como fallback (não requer autenticação)
      const response = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g, '')}/json/`)
      
      if (!response.ok) {
        throw new Error('CEP não encontrado')
      }

      const data = await response.json()
      
      if (data.erro) {
        throw new Error('CEP não encontrado')
      }

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
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Gerar etiqueta de envio (pré-postagem)
   */
  async gerarEtiqueta(destinatario, itens) {
    try {
      await this.authenticate()

      const pesoTotal = itens.reduce((sum, item) => sum + (item.peso || 0.1), 0)

      const response = await fetch(`${this.baseUrl}/prepostagem/v1/prepostagens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          idCorreios: Date.now().toString(),
          remetente: {
            nome: this.remetente.nome,
            endereco: this.remetente.endereco,
            numero: this.remetente.numero,
            complemento: this.remetente.complemento || '',
            bairro: this.remetente.bairro,
            cidade: this.remetente.cidade,
            uf: this.remetente.estado,
            cep: this.remetente.cep
          },
          destinatario: {
            nome: destinatario.nome,
            endereco: destinatario.endereco,
            numero: destinatario.numero,
            complemento: destinatario.complemento || '',
            bairro: destinatario.bairro,
            cidade: destinatario.cidade,
            uf: destinatario.estado,
            cep: destinatario.cep?.replace(/\D/g, ''),
            celular: destinatario.telefone?.replace(/\D/g, ''),
            email: destinatario.email
          },
          codigoServico: this.tipo === 'sedex' ? '04014' : '04510',
          peso: (pesoTotal * 1000).toString(), // gramas
          altura: this.tamanhoCaixa[0].toString(),
          largura: this.tamanhoCaixa[1].toString(),
          comprimento: this.tamanhoCaixa[2].toString()
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.mensagem || 'Erro ao gerar etiqueta')
      }

      const data = await response.json()
      return {
        success: true,
        codigoRastreio: data.codigoObjeto,
        etiqueta: data.etiqueta
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Rastrear encomenda
   */
  async rastrear(codigoRastreio) {
    try {
      await this.authenticate()

      const response = await fetch(`${this.baseUrl}/srorastro/v1/objetos/${codigoRastreio}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      })

      if (!response.ok) {
        throw new Error('Objeto não encontrado')
      }

      const data = await response.json()
      return {
        success: true,
        codigo: codigoRastreio,
        eventos: data.objetos?.[0]?.eventos?.map(ev => ({
          data: ev.dtHrCriado,
          local: ev.unidade?.nome || ev.unidade?.endereco?.cidade,
          status: ev.descricao,
          detalhe: ev.detalhe
        })) || []
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }
}

export default CorreiosService

/**
 * Criar instância do serviço a partir das configurações salvas
 */
export async function getCorreiosService(supabase) {
  try {
    const { data, error } = await supabase
      .from('integrations')
      .select('config')
      .eq('type', 'correios')
      .single()

    if (error || !data) {
      return null
    }

    if (!data.config.usuario || !data.config.chave_acesso) {
      return null
    }

    return new CorreiosService(data.config)
  } catch (error) {
    console.error('Erro ao carregar configuração dos Correios:', error)
    return null
  }
}
