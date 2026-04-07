import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const formatDate = (date) => {
    if (!date) return '-'
    return new Date(date).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })
}

const formatCurrency = (value) => {
    return `R$ ${parseFloat(value || 0).toFixed(2).replace('.', ',')}`
}

const formatCpfCnpj = (value) => {
    if (!value) return '-'
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.length === 11) {
        return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    } else if (cleaned.length === 14) {
        return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
    }
    return value
}

const formatPhoneGlobal = (phone) => {
    if (!phone) return '-'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 11) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
    } else if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`
    }
    return phone
}

// Convert image URL to Base64
// Convert image URL to Base64 using fetch -> Blob -> Canvas (Standardize to JPEG)
const getBase64ImageFromURL = async (url) => {
    try {
        // 1. Fetch Blob (Bypass CORS using our own Edge Function)
        // This is more reliable than public proxies
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const proxyUrl = `${supabaseUrl}/functions/v1/proxy-image?url=`

        const targetUrl = url.startsWith('http') ? url : `https://${url}`

        let finalUrl = targetUrl
        // Apply proxy for external restrictive CDNs
        if (targetUrl.includes('semijoias.net')) {
            finalUrl = proxyUrl + encodeURIComponent(targetUrl)
        }

        // Timeout wrapper for fetch
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 seconds max per image

        try {
            const response = await fetch(finalUrl, {
                signal: controller.signal
            })
            clearTimeout(timeoutId)

            if (!response.ok) throw new Error(`Status ${response.status}`)
            const blob = await response.blob()

            // 2. Create Object URL
            const objectUrl = URL.createObjectURL(blob)

            // 3. Draw to Canvas to force JPEG format and resize if needed
            return new Promise((resolve, reject) => {
                const img = new Image()
                img.onload = () => {
                    const canvas = document.createElement('canvas')
                    // Optional: Resize if too big to save PDF size
                    const maxDim = 500
                    let width = img.width
                    let height = img.height

                    if (width > maxDim || height > maxDim) {
                        const ratio = Math.min(maxDim / width, maxDim / height)
                        width *= ratio
                        height *= ratio
                    }

                    canvas.width = width
                    canvas.height = height

                    const ctx = canvas.getContext('2d')
                    // Fill white background for transparency handling
                    ctx.fillStyle = '#FFFFFF'
                    ctx.fillRect(0, 0, width, height)

                    ctx.drawImage(img, 0, 0, width, height)

                    URL.revokeObjectURL(objectUrl)
                    resolve(canvas.toDataURL('image/jpeg', 0.8)) // Force JPEG 80% quality
                }
                img.onerror = (e) => {
                    console.warn('Canvas draw failed', e)
                    URL.revokeObjectURL(objectUrl)
                    resolve(null)
                }
                img.src = objectUrl
            })
        } catch (err) {
            clearTimeout(timeoutId)
            throw err
        }
    } catch (error) {
        console.warn('Failed to load image for PDF:', url, error)
        return null
    }
}

export const generateRomaneioPDF = async ({ romaneio, lot, client, items, company, pixConfig }) => {
    const doc = new jsPDF()

    // Set font
    doc.setFont('helvetica')

    // --- Header with Logo ---
    let logoBase64 = null
    if (company?.logo_url) {
        logoBase64 = await getBase64ImageFromURL(company.logo_url)
    }

    // Logo on the left
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'JPEG', 15, 8, 20, 20)
        } catch (err) {
            console.warn('Failed to add logo to PDF:', err)
        }
    }

    // Company Name and Phone (centered)
    const companyName = company?.nome_empresa || 'Grupo AA de Importação e Compras Coletivas'
    const companyPhone = company?.whatsapp || company?.telefone || ''

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    const companyWidth = doc.getTextWidth(companyName)
    const centerX = doc.internal.pageSize.width / 2
    doc.text(companyName, centerX, 15, { align: 'center' })

    if (companyPhone) {
        // Format phone number
        const formattedPhone = formatPhoneGlobal(companyPhone)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.text(`WhatsApp: ${formattedPhone}`, centerX, 21, { align: 'center' })
    }

    // Horizontal line below header
    doc.setLineWidth(0.5)
    doc.line(15, 30, doc.internal.pageSize.width - 15, 30)

    // Romaneio Title
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')

    console.log('🔍 PDF Generator - Lot recebido:', lot)
    console.log('🔍 PDF Generator - lot?.nome:', lot?.nome)
    console.log('🔍 PDF Generator - romaneio.lote_nome:', romaneio.lote_nome)

    const lotName = lot?.nome || romaneio.lote_nome || 'Link'
    console.log('✅ PDF Generator - Nome final usado:', lotName)

    // Prepare order number
    const rawOrderNum = romaneio.numero_romaneio || romaneio.numero_pedido || romaneio.id.slice(-6)
    const orderNum = rawOrderNum.startsWith('ROM-') ? rawOrderNum : `ROM-${rawOrderNum}`

    const title = `Romaneio do `
    const titleBold = lotName
    const titleWidth = doc.getTextWidth(title)
    const titleBoldWidth = doc.getTextWidth(titleBold)
    const totalWidth = titleWidth + titleBoldWidth
    const startX = 15

    doc.text(title, startX, 38)
    doc.setFont('helvetica', 'bold')
    doc.text(titleBold, startX + titleWidth, 38)

    // Order number on the right of the same line
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(`Romaneio nº ${orderNum}`, doc.internal.pageSize.width - 15, 38, { align: 'right' })

    // --- Client Info Box ---
    const startY = 45
    const boxHeight = 30

    // Draw box with light gray background
    doc.setFillColor(249, 249, 249)
    doc.setDrawColor(221, 221, 221)
    doc.rect(15, startY, doc.internal.pageSize.width - 30, boxHeight, 'FD')

    doc.setFontSize(9)
    doc.setTextColor(0, 0, 0)
    const leftPadding = 18
    const lineHeight = 5.5
    let currentY = startY + 6

    // Bold Labels
    const drawLabelValue = (label, value, y) => {
        doc.setFont('helvetica', 'bold')
        doc.text(label, leftPadding, y)
        const labelWidth = doc.getTextWidth(label)
        doc.setFont('helvetica', 'normal')
        doc.text(value || '-', leftPadding + labelWidth + 1, y)
    }

    drawLabelValue('Cliente:', client?.nome, currentY)
    currentY += lineHeight
    drawLabelValue('CPF/CNPJ:', formatCpfCnpj(client?.cpf), currentY)
    currentY += lineHeight
    drawLabelValue('WhatsApp:', formatPhoneGlobal(client?.telefone), currentY)
    currentY += lineHeight
    drawLabelValue('E-mail:', client?.email, currentY)
    currentY += lineHeight
    drawLabelValue('Data Fechamento:', formatDate(lot?.updated_at), currentY)

    // --- Products Table ---
    // Group items by (product_id, variacao) to merge same product+variation, keep different variations as separate rows
    const groupedItemsMap = {}

    items.forEach(item => {
        const prodId = item.product_id || item.product?.id
        if (!prodId) return
        const variacao = (item.variacao || '').trim()
        const key = `${prodId}\t${variacao}`

        if (!groupedItemsMap[key]) {
            groupedItemsMap[key] = {
                ...item,
                quantidade: Number(item.quantidade),
                valor_total: Number(item.valor_total)
            }
        } else {
            groupedItemsMap[key].quantidade += Number(item.quantidade)
            groupedItemsMap[key].valor_total += Number(item.valor_total)
        }
    })

    const uniqueItems = Object.values(groupedItemsMap)
    const tableRows = []

    for (const item of uniqueItems) {
        const product = item.product || {}
        tableRows.push([
            '',
            product.category?.nome || 'Geral',
            product.descricao || product.nome || '',
            item.variacao || '-',
            formatCurrency(item.valor_unitario || item.preco_unitario),
            item.quantidade,
            formatCurrency(item.valor_total)
        ])
    }

    // Pre-load images for table (one per unique row)
    const imageMap = {}
    for (let i = 0; i < uniqueItems.length; i++) {
        const url = uniqueItems[i].product?.imagem1
        if (url) {
            const base64 = await getBase64ImageFromURL(url)
            if (base64) imageMap[i] = base64
        }
    }

    autoTable(doc, {
        startY: startY + boxHeight + 8,
        head: [['', 'CATEGORIA', 'DESCRIÇÃO', 'VARIAÇÃO', 'VALOR', 'QTD', 'TOTAL']],
        body: tableRows,
        theme: 'grid',
        styles: {
            fontSize: 8,
            cellPadding: 2.5,
            valign: 'middle',
            halign: 'center',
            minCellHeight: 22,
            lineColor: [221, 221, 221],
            lineWidth: 0.1
        },
        columnStyles: {
            0: { cellWidth: 22 }, // Image
            1: { cellWidth: 24 }, // Category
            2: { halign: 'left', cellPadding: { left: 3 } }, // Description
            3: { cellWidth: 24 }, // Variação
            4: { cellWidth: 26 }, // Price
            5: { cellWidth: 14 }, // Qty
            6: { cellWidth: 26 }  // Total
        },
        headStyles: {
            fillColor: [245, 245, 245],
            textColor: [0, 0, 0],
            lineWidth: 0.1,
            lineColor: [221, 221, 221],
            fontStyle: 'bold',
            fontSize: 7,
            halign: 'center'
        },
        bodyStyles: {
            textColor: [0, 0, 0]
        },
        // Prevent row splitting to protect images
        rowPageBreak: 'avoid',
        didDrawCell: (data) => {
            // Add image to first column (index 0) of body rows
            if (data.section === 'body' && data.column.index === 0) {
                const rowIndex = data.row.index
                const imageBase64 = imageMap[rowIndex]

                if (imageBase64) {
                    try {
                        let format = 'JPEG'
                        if (imageBase64.includes('image/png')) format = 'PNG'

                        // Center image in cell
                        const imgSize = 20
                        const x = data.cell.x + (data.cell.width - imgSize) / 2
                        const y = data.cell.y + (data.cell.height - imgSize) / 2

                        doc.addImage(imageBase64, format, x, y, imgSize, imgSize)
                    } catch (err) {
                        console.error('Erro ao desenhar imagem:', err)
                    }
                }
            }
        }
    })

    // --- Totals Section ---
    let finalY = doc.lastAutoTable.finalY + 8

    // If near end of page, add new page
    if (finalY > doc.internal.pageSize.height - 80) {
        doc.addPage()
        finalY = 20
    }

    // Horizontal line
    doc.setLineWidth(0.5)
    doc.setDrawColor(0, 0, 0)
    doc.line(15, finalY, doc.internal.pageSize.width - 15, finalY)
    finalY += 8

    const valorProdutos = Number(romaneio.valor_produtos ?? 0)
    let taxaSeparacao = Number(romaneio.taxa_separacao ?? 0)
    if (taxaSeparacao <= 0 && valorProdutos >= 1) {
        taxaSeparacao = valorProdutos <= 80 ? 15 : 25
    }
    // Sempre exibir total = produtos + taxa (evita romaneios com valor_total só de produtos)
    const valorTotalCompra = valorProdutos + taxaSeparacao

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(`• Valor Total da Compra: ${formatCurrency(valorTotalCompra)}`, 18, finalY)

    finalY += 6
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(0, 0, 0)

    const addTotalLine = (label, value) => {
        doc.text(`• ${label}: ${value}`, 18, finalY)
        finalY += 5
    }

    addTotalLine('Valor Produtos', formatCurrency(valorProdutos))
    if (taxaSeparacao > 0) addTotalLine('Custo Separação', formatCurrency(taxaSeparacao))
    addTotalLine('Quantidade Total de Produtos', romaneio.quantidade_itens)

    doc.setTextColor(0, 0, 0) // Reset to black

    // --- Payment Info (text only, no box) ---
    finalY += 8
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Dados para o pagamento:', 18, finalY)
    finalY += 6

    doc.setFont('helvetica', 'bold')
    doc.text('PAGAMENTO VIA PIX OU CARTÃO DE CRÉDITO.', 18, finalY)
    finalY += 5

    doc.setFont('helvetica', 'normal')
    if (pixConfig?.chave) {
        const isCpf = pixConfig.chave.replace(/\D/g, '').length === 11;
        const isCnpj = pixConfig.chave.replace(/\D/g, '').length === 14;
        const labelText = isCpf ? 'Chave Pix (CPF): ' : (isCnpj ? 'Chave Pix (CNPJ): ' : 'Chave Pix: ');
        const formattedPix = (isCpf || isCnpj) ? formatCpfCnpj(pixConfig.chave) : pixConfig.chave;

        doc.setFont('helvetica', 'bold')
        doc.text(labelText, 18, finalY)
        const labelWidth = doc.getTextWidth(labelText)
        doc.setFont('helvetica', 'normal')
        doc.text(formattedPix, 18 + labelWidth, finalY)
        finalY += 5
    }
    if (pixConfig?.nome_beneficiario) {
        doc.setFont('helvetica', 'bold')
        doc.text('Beneficiário: ', 18, finalY)
        const labelWidth = doc.getTextWidth('Beneficiário: ')
        doc.setFont('helvetica', 'normal')
        doc.text(pixConfig.nome_beneficiario, 18 + labelWidth, finalY)
        finalY += 5
    }
    if (pixConfig?.cidade) {
        doc.setFont('helvetica', 'bold')
        doc.text('Cidade: ', 18, finalY)
        const labelWidth = doc.getTextWidth('Cidade: ')
        doc.setFont('helvetica', 'normal')
        doc.text(pixConfig.cidade, 18 + labelWidth, finalY)
        finalY += 5
    }

    finalY += 2
    doc.setFont('helvetica', 'bold')
    doc.text('IMPORTANTE:', 18, finalY)
    const importWidth = doc.getTextWidth('IMPORTANTE:')
    doc.setFont('helvetica', 'normal')
    const importantText = ' Atenção ao pagamento, deve ser realizado assim que receber o romaneio.'
    const splitImportant = doc.splitTextToSize(importantText, doc.internal.pageSize.width - 40 - importWidth)
    doc.text(splitImportant, 18 + importWidth + 1, finalY)
    finalY += (splitImportant.length * 4) + 3

    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    const warningText = 'Caso o pagamento não seja realizado em até 24hs será removido do grupo e terá seu cadastro bloqueado permanentemente, ficando impossibilitado de realizar novas compras.'
    const splitWarning = doc.splitTextToSize(warningText, doc.internal.pageSize.width - 40)
    doc.text(splitWarning, 18, finalY)
    finalY += 8

    // --- Observations Section --- (REMOVED)
    /*
    if (romaneio.taxa_separacao > 0) {
        const obsBoxY = finalY
        const obsBoxHeight = 28
    
        // Yellow/beige background box
        doc.setFillColor(255, 248, 230)
        doc.setDrawColor(245, 230, 200)
        doc.setLineWidth(0.5)
        doc.rect(15, obsBoxY, doc.internal.pageSize.width - 30, obsBoxHeight, 'FD')
    
        finalY += 6
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 0, 0)
        doc.text('OBSERVAÇÃO', 18, finalY)
        finalY += 5
    
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text('- • Pedidos até R$ 30,00: isentos da taxa de serviço.', 18, finalY)
        finalY += 4
        doc.text('- • Pedidos entre R$ 30,01 e R$ 100,00: cobrança de R$ 20,00 de taxa de serviço.', 18, finalY)
        finalY += 4
        doc.text('- • Pedidos acima de R$ 100,00: cobrança da taxa de serviço no valor integral.', 18, finalY)
        finalY += 5
    
        doc.setFontSize(7)
        doc.setFont('helvetica', 'italic')
        const taxNote = 'As taxas visam cobrir custos operacionais, de manutenção das plataforma, e dos serviços prestados.'
        doc.text(taxNote, 18, finalY)
        finalY = obsBoxY + obsBoxHeight + 5
    }
    */

    // --- Footer ---
    const pageHeight = doc.internal.pageSize.height
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(128, 128, 128)
    doc.text(`Documento gerado em: ${formatDate(new Date())}`, 18, pageHeight - 10)

    // Pagination
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setTextColor(128, 128, 128)
        doc.text(`Página ${i}/${pageCount}`, doc.internal.pageSize.width - 18, pageHeight - 10, { align: 'right' })
    }

    // Return Blob directly
    return doc.output('blob')
}

export const generateRelatorioFabricaPDF = async ({ lot, items, company }) => {
    const doc = new jsPDF()
    doc.setFont('helvetica')

    // --- Header ---
    let logoBase64 = null
    if (company?.logo_url) {
        logoBase64 = await getBase64ImageFromURL(company.logo_url)
    }
    if (logoBase64) {
        try { doc.addImage(logoBase64, 'JPEG', 15, 8, 20, 20) } catch (e) { /* ignore */ }
    }

    const companyName = company?.nome_empresa || 'Grupo AA de Importação e Compras Coletivas'
    const centerX = doc.internal.pageSize.width / 2

    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(companyName, centerX, 15, { align: 'center' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Pedido para Fábrica — Lista Consolidada', centerX, 21, { align: 'center' })

    doc.setLineWidth(0.5)
    doc.line(15, 27, doc.internal.pageSize.width - 15, 27)

    // --- Info block ---
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`Link: ${lot?.nome || ''}`, 15, 34)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 15, 39)

    const tableRows = []
    for (const item of items) {
        tableRows.push([
            '',
            item.product?.descricao || item.product?.nome || '—',
            item.variacao || '—',
            String(item.quantidade)
        ])
    }

    const totalQtd = items.reduce((s, r) => s + r.quantidade, 0)

    // Pre-load images
    const imageMap = {}
    for (let i = 0; i < items.length; i++) {
        const url = items[i].product?.imagem1
        if (url) {
            const base64 = await getBase64ImageFromURL(url)
            if (base64) imageMap[i] = base64
        }
    }

    autoTable(doc, {
        startY: 44,
        head: [['', 'DESCRIÇÃO COMPLETA', 'VARIAÇÃO', 'QTD']],
        body: tableRows,
        theme: 'grid',
        styles: {
            fontSize: 9,
            cellPadding: 3,
            valign: 'middle',
            halign: 'center',
            minCellHeight: 22,
            lineColor: [221, 221, 221],
            lineWidth: 0.1
        },
        columnStyles: {
            0: { cellWidth: 25 },
            1: { halign: 'left', cellPadding: { left: 4 } },
            2: { cellWidth: 35 },
            3: { cellWidth: 25, fontStyle: 'bold', fontSize: 11 }
        },
        headStyles: {
            fillColor: [245, 245, 245],
            textColor: [0, 0, 0],
            lineWidth: 0.1,
            lineColor: [221, 221, 221],
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'center'
        },
        bodyStyles: {
            textColor: [0, 0, 0]
        },
        rowPageBreak: 'avoid',
        didDrawCell: (data) => {
            if (data.section === 'body' && data.column.index === 0) {
                const imageBase64 = imageMap[data.row.index]
                if (imageBase64) {
                    try {
                        let format = 'JPEG'
                        if (imageBase64.includes('image/png')) format = 'PNG'
                        const imgSize = 18
                        const x = data.cell.x + (data.cell.width - imgSize) / 2
                        const y = data.cell.y + (data.cell.height - imgSize) / 2
                        doc.addImage(imageBase64, format, x, y, imgSize, imgSize)
                    } catch (err) { /* ignore */ }
                }
            }
        }
    })

    // --- Totals (text, after table) ---
    let finalY = doc.lastAutoTable.finalY + 10

    if (finalY > doc.internal.pageSize.height - 30) {
        doc.addPage()
        finalY = 20
    }

    doc.setLineWidth(0.5)
    doc.setDrawColor(0, 0, 0)
    doc.line(15, finalY, doc.internal.pageSize.width - 15, finalY)
    finalY += 8

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(`• TOTAL DE PEÇAS PARA PRODUÇÃO: ${totalQtd}`, 18, finalY)

    // --- Page footer ---
    const pageHeight = doc.internal.pageSize.height
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(128, 128, 128)
        doc.text(`Documento gerado em: ${new Date().toLocaleString('pt-BR')}`, 18, pageHeight - 10)
        doc.text(`Página ${i}/${pageCount}`, doc.internal.pageSize.width - 18, pageHeight - 10, { align: 'right' })
    }

    return doc.output('blob')
}
