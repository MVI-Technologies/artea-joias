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

const formatCPF = (cpf) => {
    if (!cpf) return '-'
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
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

    // --- Header ---
    // Title
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    const companyName = company?.nome_empresa || 'Grupo AA de Semijoias'

    // Centered Company Name
    const companyWidth = doc.getTextWidth(companyName)
    doc.text(companyName, (doc.internal.pageSize.width - companyWidth) / 2, 20)

    // Romaneio Title
    doc.setFontSize(12)
    const title = `Romaneio do Link ${lot?.nome || ''}`
    const titleWidth = doc.getTextWidth(title)
    doc.text(title, (doc.internal.pageSize.width - titleWidth) / 2, 28)

    // Order Number (Right aligned)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    const orderNum = `${romaneio.numero_romaneio || romaneio.numero_pedido || romaneio.id.slice(-6)}`
    doc.text(orderNum, doc.internal.pageSize.width - 20, 20, { align: 'right' })

    // --- Client Info Box ---
    const startY = 35
    const boxHeight = 35
    doc.rect(14, startY, 182, boxHeight)

    doc.setFontSize(10)
    const leftPadding = 16
    const lineHeight = 6
    let currentY = startY + 6

    // Bold Labels
    const drawLabelValue = (label, value, y) => {
        doc.setFont('helvetica', 'bold')
        doc.text(label, leftPadding, y)
        const labelWidth = doc.getTextWidth(label)
        doc.setFont('helvetica', 'normal')
        doc.text(value || '-', leftPadding + labelWidth + 2, y)
    }

    drawLabelValue('Cliente: ', client?.nome, currentY)
    currentY += lineHeight
    drawLabelValue('CPF/CNPJ: ', formatCPF(client?.cpf), currentY)
    currentY += lineHeight
    drawLabelValue('WhatsApp: ', client?.telefone, currentY)
    currentY += lineHeight
    drawLabelValue('E-mail: ', client?.email, currentY)

    // Closing Date (Bottom line of box)
    // Draw line separator inside box? The image shows a single line at the bottom.
    // Actually the image shows a box around everything, and then a line separating "Data Fechamento".
    // Let's just put it at the bottom of the box.
    currentY += lineHeight
    doc.line(14, currentY - 2, 196, currentY - 2)
    drawLabelValue('Data Fechamento: ', formatDate(lot?.updated_at), currentY + 4)

    // --- Products Table ---
    // Group items by product_id to merge duplicates
    const groupedItemsMap = {}

    items.forEach(item => {
        const prodId = item.product_id || item.product?.id
        if (!prodId) return // Skip invalid items

        if (!groupedItemsMap[prodId]) {
            groupedItemsMap[prodId] = {
                ...item,
                quantidade: Number(item.quantidade),
                valor_total: Number(item.valor_total)
            }
        } else {
            groupedItemsMap[prodId].quantidade += Number(item.quantidade)
            groupedItemsMap[prodId].valor_total += Number(item.valor_total)
        }
    })

    const uniqueItems = Object.values(groupedItemsMap)
    const tableRows = []

    for (const item of uniqueItems) {
        const product = item.product || {}
        // We will handle images via didDrawCell

        tableRows.push([
            '', // Image placeholder
            product.category?.nome || 'Geral', // Categoria
            product.descricao || product.nome || '', // Descrição
            formatCurrency(item.valor_unitario || item.preco_unitario),
            item.quantidade,
            formatCurrency(item.valor_total)
        ])
    }

    // Pre-load images for table
    const imageUrls = items.map(item => item.product?.imagem1).filter(Boolean)
    // We need a map of row index to image base64
    const imageMap = {}

    // Sequential loading to avoid overwhelming network/canvas
    for (let i = 0; i < items.length; i++) {
        const url = items[i].product?.imagem1
        if (url) {
            console.log(`[PDF] Baixando imagem para item ${i}:`, url)
            const base64 = await getBase64ImageFromURL(url)
            if (base64) {
                imageMap[i] = base64
                // Log simplified size info
                console.log(`[PDF] Imagem ${i} carregada (Size: ${base64.length})`)
            }
        }
    }

    autoTable(doc, {
        startY: startY + boxHeight + 10,
        head: [['', 'Categoria', 'Descrição', 'Valor Unitário', 'Quantidade', 'Valor Total']],
        body: tableRows,
        theme: 'grid',
        styles: {
            fontSize: 9,
            cellPadding: 3,
            valign: 'middle',
            halign: 'center',
            minCellHeight: 24 // Ensure height for image (20px + padding)
        },
        columnStyles: {
            0: { cellWidth: 25 }, // Image
            1: { cellWidth: 25 }, // Category
            2: { halign: 'left' }, // Description (Auto width)
            3: { cellWidth: 30 }, // Price
            4: { cellWidth: 20 }, // Qty
            5: { cellWidth: 30 }  // Total
        },
        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            lineWidth: 0.1,
            lineColor: [0, 0, 0],
            fontStyle: 'bold'
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
    let finalY = doc.lastAutoTable.finalY + 10

    // If near end of page, add new page
    if (finalY > doc.internal.pageSize.height - 60) {
        doc.addPage()
        finalY = 20
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(`• Valor Total da Compra: ${formatCurrency(romaneio.valor_total)}`, 20, finalY)

    finalY += 8
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    const addTotalLine = (label, value) => {
        doc.text(`• ${label}: ${value}`, 20, finalY)
        finalY += 6
    }

    addTotalLine('Valor Produtos', formatCurrency(romaneio.valor_produtos))
    if (romaneio.valor_frete > 0) addTotalLine('Custo Frete', formatCurrency(romaneio.valor_frete))
    if (romaneio.taxa_separacao > 0) addTotalLine('Custo Separação', formatCurrency(romaneio.taxa_separacao))
    addTotalLine('Quantidade Total de Produtos', romaneio.quantidade_itens)

    // --- Payment Info ---
    finalY += 5
    doc.setFont('helvetica', 'bold')
    doc.text('Dados para o pagamento:', 20, finalY)
    finalY += 6

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const warningText = "Aviso Importante: Após o recebimento do romaneio, não será possível cancelar ou desistir da compra. Prazo máximo para pagamento: 24 horas após o envio do romaneio."

    const splitWarning = doc.splitTextToSize(warningText, 170)
    doc.text(splitWarning, 20, finalY)
    finalY += (splitWarning.length * 5) + 2

    doc.text(`Formas de pagamento: PIX`, 20, finalY)
    finalY += 5

    if (pixConfig?.chave) {
        doc.text(`Chave PIX: ${pixConfig.chave}`, 20, finalY)
        finalY += 5
    }
    if (pixConfig?.nome_beneficiario) {
        doc.text(`Titular: ${pixConfig.nome_beneficiario}`, 20, finalY)
        finalY += 5
    }

    const creditText = "Pagamento no cartão: Solicitar link com a administração. Após pagamento, enviar comprovante par ao financeiro."
    const splitCredit = doc.splitTextToSize(creditText, 170)
    doc.text(splitCredit, 20, finalY)

    // --- Footer ---
    const pageHeight = doc.internal.pageSize.height
    doc.setFontSize(8)
    doc.text(`Documento gerado em: ${formatDate(new Date())}`, 20, pageHeight - 10)

    // Pagination
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.text(`Página ${i}/${pageCount}`, doc.internal.pageSize.width - 20, pageHeight - 10, { align: 'right' })
    }

    // Generate Data URI
    const pdfOutput = doc.output('datauristring')
    // Remove "data:application/pdf;base64," prefix
    return pdfOutput.split(',')[1]
}
