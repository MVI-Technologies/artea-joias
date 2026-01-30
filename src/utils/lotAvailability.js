/**
 * Regra de negócio centralizada: disponibilidade de produto dentro de um lote.
 * Aplicável exclusivamente a produtos vinculados a um lote ativo.
 *
 * Fórmula: disponibilidade_lote = limite_maximo_lote - soma(unidades confirmadas no lote)
 *
 * - limite_maximo_lote: valor do campo quantidade_minima_fornecedor do produto,
 *   que neste contexto representa o total máximo de unidades que podem ser
 *   vendidas/coletadas naquele lote.
 * - soma: total de unidades confirmadas (reservas/pedidos) do produto no lote,
 *   já refletido em lot_products.quantidade_pedidos (romaneio_items não cancelados).
 *
 * Sem persistência; cálculo sempre em tempo real a partir dos dados atuais.
 */

/**
 * Calcula a disponibilidade do produto no lote (somente leitura).
 *
 * @param {number | null | undefined} limiteMaximoLote - quantidade_minima_fornecedor do produto (máx. unidades no lote)
 * @param {number | null | undefined} unidadesConfirmadas - soma de unidades confirmadas (ex.: lot_products.quantidade_pedidos)
 * @returns {number} Disponibilidade: limite - confirmadas, mínimo 0. Se limite não definido (null/0), retorna Number.POSITIVE_INFINITY (sem teto).
 */
export function disponibilidadeLote(limiteMaximoLote, unidadesConfirmadas) {
  const limite = limiteMaximoLote != null ? Number(limiteMaximoLote) : 0
  const confirmadas = unidadesConfirmadas != null ? Number(unidadesConfirmadas) : 0
  if (limite <= 0) return Number.POSITIVE_INFINITY // sem teto definido
  return Math.max(0, limite - confirmadas)
}

/**
 * Indica se o produto está esgotado no lote (disponibilidade <= 0).
 *
 * @param {number | null | undefined} limiteMaximoLote
 * @param {number | null | undefined} unidadesConfirmadas
 * @returns {boolean}
 */
export function esgotadoNoLote(limiteMaximoLote, unidadesConfirmadas) {
  const disp = disponibilidadeLote(limiteMaximoLote, unidadesConfirmadas)
  return disp !== Number.POSITIVE_INFINITY && disp <= 0
}

/**
 * Retorna o valor de disponibilidade para exibição (read-only).
 * Para "sem limite" retorna null (UI pode exibir "—" ou "Ilimitado").
 *
 * @param {number | null | undefined} limiteMaximoLote
 * @param {number | null | undefined} unidadesConfirmadas
 * @returns {number | null} Valor numérico ou null se sem teto
 */
export function disponibilidadeLoteParaExibicao(limiteMaximoLote, unidadesConfirmadas) {
  const disp = disponibilidadeLote(limiteMaximoLote, unidadesConfirmadas)
  return disp === Number.POSITIVE_INFINITY ? null : disp
}
