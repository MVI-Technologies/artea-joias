import * as XLSX from 'xlsx'

/**
 * Importar clientes de arquivo Excel
 * @param {File} file - Arquivo Excel (.xlsx, .xls)
 * @param {Object} supabase - Cliente Supabase
 * @returns {Promise<{success: number, errors: Array}>}
 */
export async function importClientsFromExcel(file, supabase) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        
        // Pegar primeira planilha
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        // Converter para JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        let success = 0
        const errors = []
        
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i]
          
          try {
            // Mapear colunas (adaptar conforme formato do Excel)
            const clientData = {
              nome: row.Nome || row.nome || row.NOME || '',
              telefone: String(row.Telefone || row.telefone || row.TELEFONE || row.WhatsApp || row.whatsapp || ''),
              email: row.Email || row.email || row.EMAIL || '',
              aniversario: parseDate(row.Aniversario || row.aniversario || row.ANIVERSARIO || row['Data Nascimento']),
              endereco: row.Endereco || row.endereco || '',
              cidade: row.Cidade || row.cidade || '',
              estado: row.Estado || row.estado || row.UF || '',
              cep: String(row.CEP || row.cep || ''),
              role: 'cliente',
              approved: true,
              cadastro_status: 'completo',
              grupo: 'Grupo Compras',
              enderecos: [{
                logradouro: row.Endereco || row.endereco || '',
                numero: row.Numero || row.numero || '',
                bairro: row.Bairro || row.bairro || '',
                cidade: row.Cidade || row.cidade || '',
                estado: row.Estado || row.estado || row.UF || '',
                cep: String(row.CEP || row.cep || '')
              }]
            }
            
            // Validar campos obrigatórios
            if (!clientData.nome || !clientData.telefone) {
              errors.push({ row: i + 2, error: 'Nome ou telefone ausente', data: row })
              continue
            }
            
            // Inserir no banco
            const { error } = await supabase
              .from('clients')
              .upsert(clientData, { onConflict: 'telefone' })
            
            if (error) {
              errors.push({ row: i + 2, error: error.message, data: row })
            } else {
              success++
            }
          } catch (err) {
            errors.push({ row: i + 2, error: err.message, data: row })
          }
        }
        
        resolve({ success, errors, total: jsonData.length })
      } catch (err) {
        reject(err)
      }
    }
    
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Parse data do Excel para formato ISO
 */
function parseDate(value) {
  if (!value) return null
  
  // Se for número (serial date do Excel)
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
  }
  
  // Se for string, tentar parsear
  if (typeof value === 'string') {
    // Formato DD/MM/YYYY
    const parts = value.split('/')
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
  }
  
  return null
}

/**
 * Gerar template Excel para importação
 */
export function generateImportTemplate() {
  const template = [
    {
      Nome: 'João da Silva',
      Telefone: '11999999999',
      Email: 'joao@email.com',
      Aniversario: '15/03/1990',
      Endereco: 'Rua Exemplo, 123',
      Bairro: 'Centro',
      Cidade: 'São Paulo',
      Estado: 'SP',
      CEP: '01234567'
    }
  ]
  
  const worksheet = XLSX.utils.json_to_sheet(template)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes')
  
  XLSX.writeFile(workbook, 'template_importacao_clientes.xlsx')
}
