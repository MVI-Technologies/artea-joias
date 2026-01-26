/**
 * Pricing Utilities for Artea Joias
 * Handles office commission (escritório) and product pricing calculations
 */

/**
 * Calculate final price with office commission (escritório) applied
 * @param {number} precoBase - Base price of the product
 * @param {number} escritorioPct - Office commission percentage (0-100)
 * @returns {number} Final price with commission, rounded to 2 decimals
 * 
 * @example
 * calcPrecoNoLote(10, 10) // Returns 11.00 (10 + 10% = 11)
 * calcPrecoNoLote(100, 6) // Returns 106.00 (100 + 6% = 106)
 */
export const calcPrecoNoLote = (precoBase, escritorioPct) => {
  if (!precoBase || precoBase <= 0) return 0
  
  const escritorio = escritorioPct || 0
  const finalPrice = precoBase * (1 + escritorio / 100)
  
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
