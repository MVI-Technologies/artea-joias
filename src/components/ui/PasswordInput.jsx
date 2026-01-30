import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import './PasswordInput.css'

export default function PasswordInput({ 
  value, 
  onChange, 
  placeholder = "Digite sua senha", 
  className = "", 
  required = false,
  ...props 
}) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="password-input-wrapper">
      <input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
        required={required}
        {...props}
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setShowPassword(!showPassword)}
        tabIndex="-1"
        aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
        title={showPassword ? "Ocultar senha" : "Exibir senha"}
      >
        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  )
}
