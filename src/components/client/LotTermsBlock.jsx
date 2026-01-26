import React from 'react'
import './LotTermsBlock.css'

/**
 * Displays lot terms/conditions at the top of the catalog
 * Shows: closing date, payment start, fees, commission, down payment %
 */
export default function LotTermsBlock({ lot }) {
  if (!lot) return null

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('pt-BR')
  }

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return 'R$ 0,00'
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value)
  }

  return (
    <div className="lot-terms-block">
      {lot.descricao && <p className="lot-terms-desc">{lot.descricao}</p>}
      
      {lot.data_fechamento && (
        <p><strong>Fechamento do Link:</strong> {formatDate(lot.data_fechamento)}</p>
      )}
      
      {lot.data_inicio_pagamento && (
        <p><strong>Começo do pagamento:</strong> {formatDate(lot.data_inicio_pagamento)}</p>
      )}
      
      {lot.taxa_separacao > 0 && (
        <p><strong>Custo Separação:</strong> {formatCurrency(lot.taxa_separacao)}</p>
      )}
      
      {lot.custo_digitacao > 0 && (
        <p><strong>Custo Digitação:</strong> {formatCurrency(lot.custo_digitacao)}</p>
      )}
      
      {lot.escritorio_pct > 0 && (
        <p><strong>Escritório:</strong> {lot.escritorio_pct}% sob o valor total dos produtos</p>
      )}
      
      {lot.percentual_entrada > 0 && (
        <p><strong>Percentual de entrada:</strong> {lot.percentual_entrada}%</p>
      )}
    </div>
  )
}
