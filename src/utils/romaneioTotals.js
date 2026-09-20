/**
 * Totais do Romaneio — fonte única da verdade
 *
 * Antes deste módulo, a regra da taxa de separação estava duplicada e
 * hardcoded em 13 pontos do app (carrinho, romaneio do cliente, romaneio do
 * admin, lista de romaneios, PDF e WhatsApp), e as demais taxas do lote
 * (motoboy, digitação, operacional) não eram exibidas nem somadas em lugar
 * nenhum — mesmo existindo colunas para elas em `romaneios` (migration 050)
 * e cálculo correto no banco (`recalculate_romaneio_values`, migration 057).
 *
 * Mesma ideia do src/utils/pricing.js para preço de produto: qualquer tela
 * que precise de taxa ou total de romaneio deve passar por aqui.
 */

/**
 * Faixas da taxa de separação, por valor dos produtos.
 * Regra vigente: R$ 15,00 até R$ 80,00 e R$ 20,00 de R$ 80,01 em diante.
 * A taxa é por FAIXA (depende do valor do pedido), não um valor fixo por lote.
 */
export const TAXA_SEPARACAO_FAIXAS = [
  { ate: 80, valor: 15 },
  { ate: Infinity, valor: 20 }
]

/**
 * Taxa de separação para um dado valor de produtos.
 * @param {number} valorProdutos
 * @returns {number} valor da taxa em R$ (0 se não há produtos)
 */
export const getTaxaSeparacao = (valorProdutos) => {
  const n = Number(valorProdutos) || 0
  if (n <= 0) return 0
  const faixa = TAXA_SEPARACAO_FAIXAS.find(f => n <= f.ate)
  return faixa ? faixa.valor : 0
}

/** Texto da regra, para exibir ao cliente nos termos do lote. */
export const descreverTaxaSeparacao = () =>
  'R$ 15,00 para pedidos até R$ 80,00 · R$ 20,00 acima de R$ 80,00'

const num = (v) => Number(v) || 0

/**
 * Calcula todas as linhas financeiras de um romaneio.
 *
 * Precedência de cada taxa: o que está gravado no romaneio vence; se estiver
 * zerado (romaneios criados antes das taxas serem aplicadas no checkout),
 * cai para o valor configurado no lote. Esse fallback é o que faz os
 * romaneios antigos exibirem o valor certo sem precisar de backfill
 * destrutivo em pedidos já pagos.
 *
 * @param {Object} params
 * @param {Object} params.romaneio - linha de `romaneios`
 * @param {Object} [params.lot] - linha de `lots` (para o fallback das taxas)
 * @returns {{valorProdutos:number, taxaSeparacao:number, custoOperacional:number,
 *   custoMotoboy:number, custoDigitacao:number, valorFrete:number,
 *   descontoCredito:number, quantidadeItens:number, total:number}}
 */
export const calcRomaneioTotals = ({ romaneio, lot } = {}) => {
  const valorProdutos = num(romaneio?.valor_produtos)
  const quantidadeItens = num(romaneio?.quantidade_itens ?? romaneio?.total_itens)

  // Separação: sempre pela faixa do valor dos produtos.
  const taxaSeparacao = getTaxaSeparacao(valorProdutos)

  // Demais taxas do lote: gravado no romaneio > configurado no lote.
  const custoMotoboy = num(romaneio?.custo_motoboy) || num(lot?.custo_motoboy)
  const custoDigitacao = num(romaneio?.custo_digitacao) || num(lot?.custo_digitacao)
  // Operacional é por item (mesma regra de recalculate_romaneio_values)
  const custoOperacional = num(romaneio?.custo_operacional) ||
    (num(lot?.custo_operacional) * quantidadeItens)

  const valorFrete = num(romaneio?.valor_frete)
  const descontoCredito = num(romaneio?.desconto_credito)

  const total = valorProdutos + taxaSeparacao + custoOperacional +
    custoMotoboy + custoDigitacao + valorFrete - descontoCredito

  return {
    valorProdutos,
    taxaSeparacao,
    custoOperacional,
    custoMotoboy,
    custoDigitacao,
    valorFrete,
    descontoCredito,
    quantidadeItens,
    total: Math.round(total * 100) / 100
  }
}
