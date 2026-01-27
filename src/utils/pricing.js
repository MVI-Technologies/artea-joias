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
