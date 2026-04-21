/**
 * Pricing Utilities for Artea Joias
 * Handles office commission (escritório) and product pricing calculations
 */

/**
 * Calculate final price with office commission (escritório) and additional per product
 * @param {number} precoBase - Base price of the product
 * @param {number} escritorioPct - Office commission percentage (0-100)
 * @param {number} adicionalPorProduto - Additional percentage per product (0-100)
 * @returns {number} Final price with all fees, rounded to 2 decimals
 * 
 * @example
 * calcPrecoNoLote(10, 10, 0) // Returns 11.00 (10 + 10% = 11)
 * calcPrecoNoLote(100, 6, 10) // Returns 116.60 (100 + 10% = 110, then 110 + 6% = 116.60)
 */
export const calcPrecoNoLote = (precoBase, escritorioPct, adicionalPorProduto = 0) => {
  if (!precoBase || precoBase <= 0) return 0

  // Primeiro aplica o adicional por produto
  const adicional = adicionalPorProduto || 0
  const precoComAdicional = precoBase * (1 + adicional / 100)

  // Depois aplica o escritório sobre o preço já com adicional
  const escritorio = escritorioPct || 0
  const finalPrice = precoComAdicional * (1 + escritorio / 100)

  // Round to 2 decimal places
  return Math.round(finalPrice * 100) / 100
}

/**
 * Calculate the final price a CLIENT pays for a product within a LOT context.
 * Handles null preco (GENERATED column not returned in joins) by falling back
 * to custo * (1 + margem_pct/100).
 *
 * This is the SINGLE SOURCE OF TRUTH for client pricing. All code paths
 * (Catalog, Cart, RomaneioDetail admin) MUST use this function.
 *
 * @param {Object} product - Product object (may have preco, custo, margem_pct)
 * @param {Object} lot - Lot object (may have adicional_por_produto, escritorio_pct)
 * @returns {number} Final price rounded to 2 decimals
 *
 * @example
 * calcPrecoClienteNoLote({ preco: 10 }, { adicional_por_produto: 10, escritorio_pct: 6 })
 * // Returns 11.66  (10 * 1.10 * 1.06)
 *
 * calcPrecoClienteNoLote({ custo: 5, margem_pct: 100 }, { adicional_por_produto: 0, escritorio_pct: 0 })
 * // Returns 10.00  (5 * 2.0 = 10, no lot fees)
 */
export const calcPrecoClienteNoLote = (product, lot) => {
  let precoBase = 0

  if (product?.preco != null && Number(product.preco) > 0) {
    precoBase = Number(product.preco)
  } else if (product?.custo != null && Number(product.custo) > 0) {
    // Fallback: preco column is GENERATED and may be null in some joins
    const margem = Number(product.margem_pct ?? 10)
    precoBase = Number(product.custo) * (1 + margem / 100)
  }

  if (precoBase <= 0) return 0

  const adicional = Number(lot?.adicional_por_produto) || 0
  const escritorio = Number(lot?.escritorio_pct) || 0

  return calcPrecoNoLote(precoBase, escritorio, adicional)
}

/**
 * Format price to BRL currency
 * @param {number} value - Price value
 * @returns {string} Formatted price (ex: "R$ 10,50")
 */
export const formatPrice = (value) => {
  if (value === null || value === undefined) return 'R$ 0,00'

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}
