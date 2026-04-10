import { useState, useRef, useEffect } from 'react'
import { COUNTRIES } from './countries'
import { ChevronDown } from 'lucide-react'
import './PhoneInput.css'

export default function PhoneInput({ value = '', onChange, className, required, placeholder = "(00) 00000-0000" }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Extract code and number from value
  const getParts = () => {
    if (!value) return { code: '+55', number: '' }
    
    if (value.startsWith('+')) {
      const sortedCountries = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length)
      const match = sortedCountries.find(c => value.startsWith(c.code))
      
      if (match) {
        return {
          code: match.code,
          number: value.substring(match.code.length).trim()
        }
      }
      
      const spaceIdx = value.indexOf(' ')
      if (spaceIdx > 0 && spaceIdx <= 5) {
        return {
          code: value.substring(0, spaceIdx),
          number: value.substring(spaceIdx).trim()
        }
      }
      
      return { code: '+55', number: value.replace('+', '') }
    }
    
    return { code: '+55', number: value }
  }

  const { code, number } = getParts()

  const formatNumber = (val, currentCode) => {
    const digits = val.replace(/\D/g, '')
    
    if (currentCode === '+55') {
       if (digits.length <= 2) return digits
       if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
       return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`
    }
    
    if (currentCode === '+1') {
       if (digits.length <= 3) return digits
       if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
       return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
    }

    if (currentCode === '+351') {
        if (digits.length <= 3) return digits
        if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`
    }
    
    return digits
  }

  const handleNumberChange = (e) => {
    const formatted = formatNumber(e.target.value, code)
    onChange(`${code} ${formatted}`)
  }

  const handleCodeSelect = (newCode) => {
    const formatted = formatNumber(number, newCode)
    onChange(`${newCode} ${formatted}`)
    setIsOpen(false)
  }

  const activeCountry = COUNTRIES.find(c => c.code === code) || { code, label: code }

  return (
    <div className="phone-input-container">
      <div className="custom-select-container" ref={dropdownRef}>
        <div 
          className="form-input custom-select-trigger" 
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="selected-value">
            {activeCountry.label.split(' ')[0]} {code}
          </span>
          <ChevronDown size={14} className="text-muted" />
        </div>
        
        {isOpen && (
          <div className="custom-select-dropdown">
            {COUNTRIES.map(c => (
              <div 
                key={c.code} 
                className={`custom-select-option ${code === c.code ? 'selected' : ''}`}
                onClick={() => handleCodeSelect(c.code)}
              >
                {c.label}
              </div>
            ))}
          </div>
        )}
      </div>

      <input
        type="tel"
        className={className || "form-input"}
        placeholder={code === '+1' ? "(000) 000-0000" : code === '+351' ? "000 000 000" : placeholder}
        value={number}
        onChange={handleNumberChange}
        maxLength={16}
        required={required}
        style={{ flexGrow: 1 }}
      />
    </div>
  )
}
