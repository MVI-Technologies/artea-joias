# Integração Cliente - Order Status Tracking

Criar componente visual de timeline de status para os pedidos do cliente.

## Status do Pedido
- `reservado` - Reserva confirmada (🟡 Amarelo)
- `aguardando_pagamento` - Link fechado, aguardando pagamento (🟠 Laranja)
- `pago` - Pagamento confirmado (🟢 Verde)
- `em_separacao` - Em separação (🔵 Azul)
- `enviado` - Enviado (🚚 Azul escuro)
- `concluido` - Entregue (✅ Verde check)
- `cancelado` - Cancelado (❌ Vermelho)

## Implementação

### ClientOrders.jsx
Adicionar timeline visual para cada pedido mostrando progresso através dos estados.

### Código Base

```javascript
const StatusTimeline = ({ status }) => {
  const stages = [
    { key: 'reservado', label: 'Reservado', icon: '📝' },
    { key: 'aguardando_pagamento', label: 'Aguardando Pag.', icon: '💰' },
    { key: 'pago', label: 'Pago', icon: '✅' },
    { key: 'em_separacao', label: 'Separação', icon: '📦' },
    { key: 'enviado', label: 'Enviado', icon: '🚚' },
    { key: 'concluido', label: 'Entregue', icon: '🎉' }
  ]
  
  const currentIndex = stages.findIndex(s => s.key === status)
  
  return (
    <div className="status-timeline">
      {stages.map((stage, index) => (
        <div 
          key={stage.key}
          className={`timeline-stage ${index <= currentIndex ? 'active' : ''} ${index === currentIndex ? 'current' : ''}`}
        >
          <div className="stage-icon">{stage.icon}</div>
          <div className="stage-label">{stage.label}</div>
        </div>
      ))}
    </div>
  )
}
```

### CSS

```css
.status-timeline {
  display: flex;
  justify-content: space-between;
  margin: 20px 0;
  position: relative;
}

.status-timeline::before {
  content: '';
  position: absolute;
  top: 15px;
  left: 5%;
  right: 5%;
  height: 2px;
  background: #e2e8f0;
  z-index: 0;
}

.timeline-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  position: relative;
  z-index: 1;
  opacity: 0.5;
}

.timeline-stage.active {
  opacity: 1;
}

.timeline-stage.current {
  font-weight: 600;
}

.stage-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: white;
  border: 2px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.timeline-stage.active .stage-icon {
  border-color: #3b82f6;
  background: #dbeafe;
}

.timeline-stage.current .stage-icon {
  border-color: #2563eb;
  background: #3b82f6;
  color: white;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
}

.stage-label {
  font-size: 11px;
  color: #64748b;
  text-align: center;
  max-width: 70px;
}

.timeline-stage.active .stage-label {
  color: #1e293b;
}
```
