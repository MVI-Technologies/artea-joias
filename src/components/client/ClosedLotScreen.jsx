import { useNavigate } from 'react-router-dom'
import './ClosedLotScreen.css'

export default function ClosedLotScreen({ lotName }) {
  const navigate = useNavigate()
  
  return (
    <div className="closed-lot-screen">
      <img 
        src="/images/closed-lot.png" 
        alt="Link Fechado" 
        className="closed-lot-image"
      />
      <h1 className="closed-lot-title">Link fechado!</h1>
      {lotName && (
        <p className="closed-lot-name">{lotName}</p>
      )}
      <p className="closed-lot-message">
        Este link de compra foi encerrado. 
        Entre em contato para mais informações.
      </p>
      <button 
        onClick={() => navigate('/app')} 
        className="btn btn-primary btn-back-home"
      >
        Voltar para Início
      </button>
    </div>
  )
}
