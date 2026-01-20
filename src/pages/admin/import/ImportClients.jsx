import { useState } from 'react'
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import { importClientsFromExcel, generateImportTemplate } from '../../../utils/excelImport'
import './ImportClients.css'

export default function ImportClients() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
    }
  }

  const handleImport = async () => {
    if (!file) {
      alert('Selecione um arquivo')
      return
    }

    setLoading(true)
    try {
      const importResult = await importClientsFromExcel(file, supabase)
      setResult(importResult)
    } catch (error) {
      console.error('Erro na importação:', error)
      setResult({ success: 0, errors: [{ error: error.message }], total: 0 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="import-clients-page">
      <div className="page-header">
        <h1><FileSpreadsheet size={24} /> Importar Clientes</h1>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="import-instructions">
            <h3>Instruções</h3>
            <ol>
              <li>Baixe o template de importação clicando no botão abaixo</li>
              <li>Preencha os dados dos clientes no arquivo Excel</li>
              <li>Faça upload do arquivo preenchido</li>
              <li>Clique em "Importar" para processar</li>
            </ol>
            
            <button className="btn btn-outline" onClick={generateImportTemplate}>
              <Download size={16} /> Baixar Template
            </button>
          </div>

          <hr />

          <div className="import-upload">
            <label className="upload-area">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                hidden
              />
              <Upload size={32} className="text-muted" />
              <span>
                {file ? file.name : 'Clique para selecionar ou arraste o arquivo aqui'}
              </span>
              <small className="text-muted">Formatos aceitos: .xlsx, .xls</small>
            </label>

            {file && (
              <button 
                className="btn btn-primary btn-lg"
                onClick={handleImport}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="loading-spinner" /> Importando...
                  </>
                ) : (
                  <>
                    <Upload size={18} /> Importar
                  </>
                )}
              </button>
            )}
          </div>

          {/* Results */}
          {result && (
            <div className="import-result">
              <div className={`result-summary ${result.success > 0 ? 'success' : 'error'}`}>
                {result.success > 0 ? (
                  <CheckCircle size={24} />
                ) : (
                  <AlertCircle size={24} />
                )}
                <div>
                  <strong>{result.success} de {result.total}</strong> clientes importados com sucesso
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="result-errors">
                  <h4><AlertCircle size={16} /> Erros encontrados ({result.errors.length})</h4>
                  <div className="errors-list">
                    {result.errors.slice(0, 10).map((err, idx) => (
                      <div key={idx} className="error-item">
                        <strong>Linha {err.row}:</strong> {err.error}
                      </div>
                    ))}
                    {result.errors.length > 10 && (
                      <div className="error-item text-muted">
                        ... e mais {result.errors.length - 10} erro(s)
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
