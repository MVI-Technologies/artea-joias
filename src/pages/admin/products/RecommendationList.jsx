export default function RecommendationList() {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Recomendações</h1>
          <p className="page-subtitle">Em desenvolvimento - Configure recomendações de produtos</p>
        </div>
      </div>

      <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
        <h3 style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
          Funcionalidade em Desenvolvimento
        </h3>
        <p style={{ color: 'var(--text-muted)' }}>
          O sistema de recomendações será implementado em breve.
          <br />
          Esta funcionalidade permitirá sugerir produtos complementares aos clientes.
        </p>
      </div>
    </div>
  )
}
