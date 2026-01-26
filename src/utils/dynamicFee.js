/**
 * Dynamic Fee Utilities for Artea Joias
 * Calculates administrative fee based on cart total value (not quantity)
 */

/**
 * Calculate dynamic fee based on cart subtotal and configured tiers
 * @param {number} subtotal - Total value of cart (with escritório applied)
 * @param {Array} rules - Array of tier rules: [{max: 80, fee: 15}, {max: 150, fee: 25}, ...]
 * @returns {number} Fee amount in R$
 * 
 * @example
 * const rules = [{max: 80, fee: 15}, {max: 150, fee: 25}]
 * calculateDynamicFee(50, rules)   // Returns 15 (50 <= 80)
 * calculateDynamicFee(100, rules)  // Returns 25 (100 > 80 and <= 150)
 * calculateDynamicFee(200, rules)  // Returns 25 (above all tiers, use last)
 */
export const calculateDynamicFee = (subtotal, rules) => {
  // No rules or empty rules = no fee
  if (!rules || !Array.isArray(rules) || rules.length === 0) {
    return 0
  }
  
  // Sort rules by max value ascending
  const sortedRules = [...rules].sort((a, b) => a.max - b.max)
  
  // Find the first tier where subtotal <= max
  for (const tier of sortedRules) {
    if (subtotal <= tier.max) {
      return tier.fee || 0
    }
  }
  
  // If subtotal exceeds all tiers, use the last tier's fee
  const lastTier = sortedRules[sortedRules.length - 1]
  return lastTier.fee || 0
}

/**
 * Parse dynamic fee rules from text input
 * Format: "80 - 15" or "80-15" means "up to R$80 = fee R$15"
 * @param {string} text - Multi-line text with rules
 * @returns {Array} Parsed rules array
 * 
 * @example
 * parseDynamicFeeRules("80 - 15\n150 - 25")
 * // Returns [{max: 80, fee: 15}, {max: 150, fee: 25}]
 */
export const parseDynamicFeeRules = (text) => {
  if (!text || typeof text !== 'string') return []
  
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
  const rules = []
  
  for (const line of lines) {
    // Match formats: "80 - 15", "80-15", "80: 15", etc.
    const match = line.match(/(\d+(?:\.\d+)?)\s*[-:]\s*(\d+(?:\.\d+)?)/)
    if (match) {
      rules.push({
        max: parseFloat(match[1]),
        fee: parseFloat(match[2])
      })
    }
  }
  
  return rules
}

/**
 * Format rules array to text for display/editing
 * @param {Array} rules - Rules array
 * @returns {string} Formatted text
 * 
 * @example
 * formatDynamicFeeRules([{max: 80, fee: 15}, {max: 150, fee: 25}])
 * // Returns "80 - 15\n150 - 25"
 */
export const formatDynamicFeeRules = (rules) => {
  if (!rules || !Array.isArray(rules) || rules.length === 0) return ''
  
  return rules
    .map(rule => `${rule.max} - ${rule.fee}`)
    .join('\n')
}
