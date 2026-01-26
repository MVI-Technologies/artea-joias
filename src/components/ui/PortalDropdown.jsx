import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import './PortalDropdown.css'

/**
 * PortalDropdown - Dropdown menu com renderização via Portal
 * Resolve problemas de overflow e posicionamento em mobile
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.trigger - Elemento que abre o dropdown
 * @param {React.ReactNode} props.children - Conteúdo do dropdown
 * @param {boolean} props.isOpen - Estado do dropdown
 * @param {Function} props.onClose - Callback ao fechar
 * @param {string} props.align - Alinhamento (left|right)
 * @param {boolean} props.showCloseButton - Mostrar botão X para fechar
 */
export default function PortalDropdown({
  trigger,
  children,
  isOpen,
  onClose,
  align = 'right',
  showCloseButton = false
}) {
  const triggerRef = useRef(null)
  const dropdownRef = useRef(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [placement, setPlacement] = useState('bottom') // bottom ou top

  // Calcular posição do dropdown
  useEffect(() => {
    if (!isOpen || !triggerRef.current || !dropdownRef.current) return

    const calculatePosition = () => {
      const triggerRect = triggerRef.current.getBoundingClientRect()
      const dropdownRect = dropdownRef.current.getBoundingClientRect()

      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const padding = 8 // Margem das bordas

      let top = triggerRect.bottom + padding
      let left = triggerRect.left

      // Alinhamento à direita
      if (align === 'right') {
        left = triggerRect.right - dropdownRect.width
      }

      // Ajustar se não couber embaixo -> abrir para cima
      const spaceBelow = viewportHeight - triggerRect.bottom
      const spaceAbove = triggerRect.top

      if (spaceBelow < dropdownRect.height + padding && spaceAbove > spaceBelow) {
        top = triggerRect.top - dropdownRect.height - padding
        setPlacement('top')
      } else {
        setPlacement('bottom')
      }

      // Ajustar lateralmente se não couber
      if (left < padding) {
        left = padding
      } else if (left + dropdownRect.width > viewportWidth - padding) {
        left = viewportWidth - dropdownRect.width - padding
      }

      // Clampar valores finais
      left = Math.max(padding, Math.min(left, viewportWidth - dropdownRect.width - padding))
      top = Math.max(padding, Math.min(top, viewportHeight - dropdownRect.height - padding))

      setPosition({ top, left })
    }

    calculatePosition()
  }, [isOpen, align])

  // Removido o fechamento ao rolar para permitir scroll interno e melhor UX em mobile
  useEffect(() => {
    // Não faz nada, o dropdown agora permanece aberto ao rolar a página
  }, [isOpen])

  // Fechar ao clicar fora
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target)
      ) {
        onClose()
      }
    }

    // Usar mousedown para capturar antes do click
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Fechar com ESC
  useEffect(() => {
    if (!isOpen) return

    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  return (
    <>
      <div ref={triggerRef} style={{ display: 'inline-block' }}>
        {trigger}
      </div>

      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className={`portal-dropdown portal-dropdown--${placement}`}
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          {showCloseButton && (
            <div className="dropdown-close-header">
              <button
                className="dropdown-close-btn"
                onClick={onClose}
                aria-label="Fechar menu"
              >
                <X size={18} />
              </button>
            </div>
          )}
          {children}
        </div>,
        document.body
      )}
    </>
  )
}
