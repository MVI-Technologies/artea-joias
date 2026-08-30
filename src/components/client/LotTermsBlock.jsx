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
      {/* Descrição agora é renderizada separadamente no Catalog.jsx para controle de posição */}

      {lot.data_fechamento && (
        <p><strong>Fechamento do Link:</strong> {formatDate(lot.data_fechamento)}</p>
      )}

      {lot.data_inicio_pagamento && (
        <p><strong>Começo do pagamento:</strong> {formatDate(lot.data_inicio_pagamento)}</p>
      )}

      {lot.custo_separacao > 0 && (
        <p><strong>Custo Separação:</strong> {formatCurrency(lot.custo_separacao)}</p>
      )}

      {lot.custo_motoboy > 0 && (
        <p><strong>Custo Motoboy:</strong> {formatCurrency(lot.custo_motoboy)}</p>
      )}

      {lot.custo_operacional > 0 && (
        <p><strong>Custo Operacional:</strong> {formatCurrency(lot.custo_operacional)} por produto</p>
      )}

      {lot.custo_digitacao > 0 && (
        <p><strong>Custo Digitação:</strong> {formatCurrency(lot.custo_digitacao)}</p>
      )}

      {/* Escritório e Adicional por produto são taxas já embutidas no preço
          final exibido ao cliente (ver calcPrecoClienteNoLote em
          src/utils/pricing.js) — o percentual em si nunca deve ser
          revelado ao comprador, só o preço final já com tudo incluso. */}

      {lot.percentual_entrada > 0 && (
        <p><strong>Percentual de entrada:</strong> {lot.percentual_entrada}%</p>
      )}
    </div>
  )
}
