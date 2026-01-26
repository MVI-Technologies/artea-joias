import { useState, useRef } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function ImageUpload({ value, onChange, onUploadStart, onUploadEnd, className = '', bucketName = 'products', label, height, width, rounded }) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef(null)

  // ... (drag handlers unchanged)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files[0])
    }
  }

  const handleChange = (e) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files[0])
    }
  }

  const onButtonClick = () => {
    if (inputRef.current) {
      inputRef.current.click()
    }
  }

  const handleFiles = async (file) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione apenas arquivos de imagem.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB.')
      return
    }

    try {
      setUploading(true)
      if (onUploadStart) onUploadStart()

      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '')
      const fileExt = cleanFileName.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath)

      if (onChange) onChange(data.publicUrl)

    } catch (error) {
      console.error('Erro no upload:', error)
      alert('Erro ao fazer upload da imagem: ' + (error.message || 'Erro desconhecido'))
    } finally {
      setUploading(false)
      if (onUploadEnd) onUploadEnd()
    }
  }

  const handleRemove = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (onChange) onChange('')
  }

  return (
    <div className={`image-upload-container ${className}`}>
      {value ? (
        <div className="image-preview-wrapper relative group" style={{ position: 'relative' }}>
          <img 
            src={value} 
            alt="Preview" 
            style={{ width: '100%', height: '160px', objectFit: 'contain', borderRadius: '8px', background: '#f8f9fa', border: '1px solid #ddd' }}
          />
          <button
            onClick={handleRemove}
            type="button"
            className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacidade-hover"
            style={{ 
              position: 'absolute', 
              top: '8px', 
              right: '8px', 
              background: 'rgba(239, 68, 68, 0.9)', 
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10
            }}
            title="Remover imagem"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div 
          className={`upload-dropzone`}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '160px',
            border: `2px dashed ${dragActive ? '#2196f3' : '#ccc'}`,
            borderRadius: '8px',
            backgroundColor: dragActive ? '#e3f2fd' : '#f8f9fa',
            cursor: uploading ? 'wait' : 'pointer',
            position: 'relative',
            transition: 'all 0.2s ease'
          }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
            {uploading ? (
              <>
                <Loader2 className="mb-2 text-gray-500 animate-spin" size={24} />
                <p className="text-sm text-gray-500">Enviando...</p>
              </>
            ) : (
              <>
                <Upload className="mb-2 text-gray-400" size={24} style={{ marginBottom: '8px', color: '#888' }} />
                <p className="text-sm text-gray-500" style={{ fontSize: '13px', color: '#666', margin: 0 }}>
                  <span style={{ fontWeight: 600, color: '#2196f3' }}>Clique para enviar</span>
                </p>
              </>
            )}
          </div>
          <input 
            ref={inputRef}
            type="file" 
            className="hidden" 
            accept="image/*"
            onChange={handleChange}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </div>
      )}
    </div>
  )
}
