import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShoppingCart, Trash2, ArrowRight, AlertTriangle, CheckCircle, Plus, Minus, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { generateRomaneioPDF } from '../../utils/pdfGenerator'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/common/Toast'
import './Cart.css'

export default function Cart() {
    const navigate = useNavigate()
    const { user, client } = useAuth()
    const toast = useToast()
    const [cartItems, setCartItems] = useState([])
    const [groupedItems, setGroupedItems] = useState({})
    const [loading, setLoading] = useState(true)
    const [checkoutLoading, setCheckoutLoading] = useState(false)

    useEffect(() => {
        loadCart()
    }, [])

    const loadCart = async () => {
        setLoading(true)
        try {
            // Ler de todas as chaves cart_lotID do localStorage
            const allItems = []
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key.startsWith('cart_')) {
                    const items = JSON.parse(localStorage.getItem(key))
                    if (Array.isArray(items)) {
                        allItems.push(...items)
                    }
                }
            }

            // Agrupar por lot_id
            const grouped = {}

            // Buscar infos dos lotes para mostrar nomes
            const lotIds = [...new Set(allItems.map(i => i.lot_id))]
            let lotsMap = {}

            if (lotIds.length > 0) {
                const { data: lots } = await supabase
                    .from('lots')
                    .select('id, nome, status, data_fim, permitir_modificacao_produtos, exigir_dados_galvanica')
                    .in('id', lotIds)

                lots?.forEach(l => lotsMap[l.id] = l)
            }

            allItems.forEach(item => {
                if (!grouped[item.lot_id]) {
                    grouped[item.lot_id] = {
                        lot: lotsMap[item.lot_id] || { nome: 'Link Indisponível', status: 'fechado' },
                        items: [],
                        total: 0
                    }
                }
                grouped[item.lot_id].items.push(item)
                grouped[item.lot_id].total += item.preco * item.quantity
            })

            setGroupedItems(grouped)
            setCartItems(allItems)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const updateQuantity = (lotId, itemId, delta) => {
        const key = `cart_${lotId}`
        let items = JSON.parse(localStorage.getItem(key) || '[]')

        // Verificar configuração do lote
        const group = groupedItems[lotId]
        const permitirModificacao = group?.lot?.permitir_modificacao_produtos || 'permitir_reduzir_excluir'

        // Se não permite modificação, bloquear
        if (permitirModificacao === 'nao_permitir') {
            toast.error('Este catálogo não permite modificar quantidades. Entre em contato com o administrador.')
            return
        }

        items = items.map(item => {
            if (item.id === itemId) {
                return { ...item, quantity: Math.max(1, item.quantity + delta) }
            }
            return item
        })

        localStorage.setItem(key, JSON.stringify(items))
        loadCart() // Reload UI
    }

    const removeItem = (lotId, itemId) => {
        const key = `cart_${lotId}`
        let items = JSON.parse(localStorage.getItem(key) || '[]')

        // Verificar configuração do lote
        const group = groupedItems[lotId]
        const permitirModificacao = group?.lot?.permitir_modificacao_produtos || 'permitir_reduzir_excluir'

        // Se não permite excluir
        if (permitirModificacao === 'nao_permitir' || permitirModificacao === 'permitir_reduzir_nao_excluir') {
            toast.error('Este catálogo não permite remover produtos. Entre em contato com o administrador.')
            return
        }

        items = items.filter(item => item.id !== itemId)

        if (items.length === 0) {
            localStorage.removeItem(key)
        } else {
            localStorage.setItem(key, JSON.stringify(items))
        }
        loadCart()
    }

    const generateRomaneioNumber = () => {
        const now = new Date()
        const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
        return `ROM-${dateStr}-${random}`
    }

    const handleDownloadRomaneioPDF = async (romaneioId, fileName, items, lot) => {
        if (!romaneioId) {
            throw new Error('ID do romaneio não fornecido')
        }

        console.log('Gerando PDF para romaneio:', romaneioId)

        try {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                throw new Error('Sessão não encontrada. Faça login novamente.')
            }

            // Buscar dados adicionais para o PDF (Company, PIX)
            const { data: company } = await supabase
                .from('company_settings')
                .select('*')
                .single()

            const { data: pixInt } = await supabase
                .from('integrations')
                .select('config')
                .eq('type', 'pix')
                .single()

            // Buscar dados do romaneio completo se não passados
            let romaneioData = {
                id: romaneioId,
                numero_romaneio: romaneioId, // Fallback
                valor_total: items.reduce((acc, i) => acc + i.valor_total, 0),
                valor_produtos: items.reduce((acc, i) => acc + i.valor_total, 0),
                quantidade_itens: items.reduce((acc, i) => acc + i.quantidade, 0),
                created_at: new Date().toISOString(),
                // Default props expected by generator
                client: client || { nome: 'Cliente' }
            }

            // Tentar buscar romaneio real para garantir dados corretos (ex: numero_romaneio gerado pelo trigger)
            const { data: realRomaneio } = await supabase
                .from('romaneios')
                .select('*')
                .eq('id', romaneioId)
                .single()

            if (realRomaneio) {
                romaneioData = realRomaneio
            }

            const pdfBase64 = await generateRomaneioPDF({
                romaneio: romaneioData,
                lot: lot || { nome: 'Catálogo' },
                client: client,
                items: items,
                company: company,
                pixConfig: pixInt?.config
            })

            if (!pdfBase64) {
                throw new Error('Falha ao gerar conteúdo do PDF')
            }

            const link = document.createElement('a')
            link.href = `data:application/pdf;base64,${pdfBase64}`
            link.download = fileName || `Romaneio-${romaneioId.slice(0, 8)}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            return true
        } catch (error) {
            console.error('Erro ao gerar PDF:', error)
            throw error
        }
    }

    const handleCheckout = async (lotId) => {
        console.log('🚀 INICIANDO CHECKOUT para lotId:', lotId)
        setCheckoutLoading(true)
        try {
            const group = groupedItems[lotId]

            if (!group) {
                console.error('❌ Grupo não encontrado para lotId:', lotId)
                toast.error('Erro: Grupo não encontrado.')
                return
            }

            console.log('✅ Grupo encontrado:', group.lot.nome)
            console.log('📦 Itens no grupo:', group.items.length)

            // Verificar se o lote exige dados de galvânica
            if (group.lot.exigir_dados_galvanica) {
                // Verificar se os produtos têm dados de galvanização
                const produtosSemGalvanica = group.items.filter(item => {
                    return !item.dados_galvanica || item.dados_galvanica.trim() === ''
                })

                if (produtosSemGalvanica.length > 0) {
                    toast.error(
                        `Este catálogo exige dados de galvanização. ` +
                        `Por favor, adicione os dados de galvanização para todos os produtos antes de finalizar.`,
                        { duration: 5000 }
                    )
                    return
                }
            }

            // Verificar e refrescar sessão antes de prosseguir
            console.log('🔐 Verificando sessão...')
            let { data: { session }, error: sessionError } = await supabase.auth.getSession()

            console.log('📋 Estado da sessão:', {
                hasSession: !!session,
                hasUser: !!session?.user,
                userId: session?.user?.id,
                sessionError: sessionError?.message
            })

            // Se não há sessão válida, tentar refrescar
            if (!session?.user && !sessionError) {
                console.log('⚠️ Sessão expirada, tentando refrescar...')
                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
                if (!refreshError && refreshData?.session) {
                    session = refreshData.session
                    console.log('✅ Sessão refrescada com sucesso')
                } else {
                    console.error('❌ Erro ao refrescar sessão:', refreshError)
                }
            }

            if (!session?.user) {
                console.error('❌ ERRO: Sessão inválida ou expirada')
                console.error('Detalhes:', { sessionError, session })
                toast.error('Erro de autenticação. Faça login novamente.')
                // Aguardar um pouco para garantir que o toast apareça
                await new Promise(resolve => setTimeout(resolve, 1000))
                navigate('/login')
                return
            }

            console.log('✅ Sessão válida. User ID:', session.user.id)

            // Garantir que temos os dados do cliente
            console.log('👤 Verificando dados do cliente...')
            console.log('Cliente do contexto:', client ? { id: client.id, nome: client.nome, auth_id: client.auth_id } : 'null')

            let finalClient = client

            // Se não temos cliente no contexto, tentar buscar do banco
            if (!finalClient && session.user) {
                console.log('⚠️ Cliente não encontrado no contexto, buscando do banco...')
                console.log('🔍 Buscando cliente com auth_id:', session.user.id)

                // Tentar buscar o cliente novamente - usar .maybeSingle() para não dar erro se não encontrar
                const { data: clientData, error: clientError } = await supabase
                    .from('clients')
                    .select('*')
                    .eq('auth_id', session.user.id)
                    .maybeSingle()

                console.log('📊 Resultado da busca:', {
                    found: !!clientData,
                    error: clientError?.message,
                    code: clientError?.code,
                    httpStatus: clientError?.statusCode
                })

                // Se houver erro que não seja "não encontrado", tratar como erro crítico
                if (clientError) {
                    // PGRST116 = nenhum resultado encontrado (isso é OK, vamos tratar abaixo)
                    if (clientError.code === 'PGRST116') {
                        console.warn('⚠️ Cliente não encontrado (PGRST116) - isso é esperado se não existe registro')
                    } else {
                        console.error('❌ ERRO ao buscar cliente do banco:', clientError)
                        console.error('Detalhes completos:', JSON.stringify(clientError, null, 2))
                        toast.error('Erro ao buscar dados do cliente. Tente novamente.')
                        return
                    }
                }

                // Se encontrou o cliente, usar ele
                if (clientData) {
                    finalClient = clientData
                    console.log('✅ Cliente encontrado no banco:', { id: finalClient.id, nome: finalClient.nome })
                }
            }

            // Se ainda não temos cliente após todas as tentativas, é um problema crítico
            if (!finalClient) {
                console.error('❌ ERRO CRÍTICO: Cliente não encontrado na tabela clients')
                console.error('📋 Informações do usuário:', {
                    userId: session.user.id,
                    email: session.user.email,
                    userMetadata: session.user.user_metadata
                })
                console.error('🔍 Isso indica que:')
                console.error('   1. O usuário está autenticado no Supabase Auth')
                console.error('   2. Mas não existe registro na tabela clients com esse auth_id')
                console.error('   3. A função RPC checkout_romaneio também vai falhar por isso')
                console.error('💡 Solução: Criar registro na tabela clients ou verificar se foi deletado')

                toast.error('Erro: Seu perfil não foi encontrado no sistema. Entre em contato com o suporte.')
                return
            }

            // Verificar se o cliente tem auth_id válido
            console.log('🔍 Validando auth_id do cliente...')
            console.log('Comparação:', {
                clientAuthId: finalClient.auth_id,
                sessionUserId: session.user.id,
                match: finalClient.auth_id === session.user.id
            })

            if (!finalClient.auth_id || finalClient.auth_id !== session.user.id) {
                console.error('❌ ERRO: auth_id inválido ou não corresponde')
                console.error('Detalhes:', {
                    clientAuthId: finalClient.auth_id,
                    sessionUserId: session.user.id,
                    match: finalClient.auth_id === session.user.id
                })
                toast.error('Erro de autenticação. Faça login novamente.')
                await new Promise(resolve => setTimeout(resolve, 1000))
                navigate('/login')
                return
            }

            console.log('✅ Cliente validado com sucesso')

            // 1. Preparar Payload para RPC
            const itemsPayload = group.items.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                valor_unitario: item.preco
            }))

            const clientSnapshot = {
                nome: finalClient.nome,
                telefone: finalClient.telefone,
                endereco: finalClient.enderecos?.[0] || null
            }

            // 2. Verificar novamente a sessão antes de chamar RPC
            // Garantir que o token está válido
            const { data: { session: currentSession } } = await supabase.auth.getSession()
            if (!currentSession?.access_token) {
                console.error('Token de acesso não encontrado')
                toast.error('Erro de autenticação. Faça login novamente.')
                navigate('/login')
                return
            }

            // 2. Chamar RPC Transacional
            console.log('📞 Chamando checkout_romaneio RPC...')
            console.log('📋 Parâmetros:', {
                lotId,
                itemsCount: itemsPayload.length,
                sessionUserId: currentSession.user.id,
                clientAuthId: finalClient.auth_id,
                clientId: finalClient.id,
                tokenPresent: !!currentSession.access_token
            })

            const { data: romaneio, error: rpcError } = await supabase.rpc('checkout_romaneio', {
                p_lot_id: lotId,
                p_items: itemsPayload,
                p_client_snapshot: clientSnapshot
            })

            if (rpcError) {
                console.error('❌ ERRO RPC:', rpcError)
                console.error('📋 Detalhes completos do erro:', JSON.stringify(rpcError, null, 2))
                console.error('🔍 Tipo do erro:', rpcError.code)
                console.error('📝 Mensagem:', rpcError.message)
                console.error('📊 Erro completo:', rpcError)

                // Mensagens de erro mais específicas
                if (rpcError.message?.includes('Cliente não encontrado') || rpcError.message?.includes('não encontrado para o usuário logado')) {
                    console.error('❌ ERRO DE AUTENTICAÇÃO: Cliente não encontrado na RPC')
                    toast.error('Erro de autenticação. Faça login novamente.')
                    await new Promise(resolve => setTimeout(resolve, 1000))
                    navigate('/login')
                } else if (rpcError.message?.includes('não está aberto')) {
                    console.error('❌ ERRO: Lote não está aberto')
                    toast.error(rpcError.message)
                } else {
                    console.error('❌ ERRO DESCONHECIDO na RPC')
                    throw new Error(rpcError.message || 'Erro ao processar pedido')
                }
                return
            }

            console.log('✅ RPC executada com sucesso!')

            if (!romaneio || !romaneio.id) {
                throw new Error('Erro: Romaneio não retornado pelo servidor.')
            }

            console.log('Romaneio criado/atualizado com sucesso:', romaneio.id)

            // 3. Preparar itens para PDF (Snapshots visuais)
            const itemsForPDF = group.items.map(item => ({
                quantidade: item.quantity,
                valor_unitario: item.preco,
                valor_total: item.preco * item.quantity,
                product: {
                    nome: item.nome,
                    descricao: item.descricao,
                    codigo_sku: item.codigo_sku,
                    category: item.category || item.categoria || (item.categoria_nome ? { nome: item.categoria_nome } : null)
                }
            }))

            // 4. Gerar e baixar PDF
            await handleDownloadRomaneioPDF(romaneio.id, `Romaneio-${group.lot.nome}.pdf`, itemsForPDF, group.lot)

            // 5. Limpar Carrinho Local
            localStorage.removeItem(`cart_${lotId}`)

            // 6. Sucesso
            toast.success('Pedido realizado com sucesso! Romaneio gerado.')
            navigate('/app/historico')

        } catch (error) {
            console.error('❌ ERRO GERAL no checkout:', error)
            console.error('📋 Stack trace:', error.stack)
            console.error('📝 Mensagem:', error.message)
            console.error('🔍 Tipo:', error.name)
            console.error('📊 Erro completo:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
            toast.error('Erro ao finalizar pedido: ' + (error.message || 'Tente novamente.'))
        } finally {
            console.log('🏁 Finalizando processo de checkout')
            setCheckoutLoading(false)
        }
    }

    if (loading) return (
        <div className="cart-page">
            <div className="text-center py-16 text-slate-500">Carregando carrinho...</div>
        </div>
    )

    return (
        <div className="cart-page">
            <div className="cart-header">
                <h1>Seu Carrinho</h1>
                <p>Revise seus itens antes de confirmar.</p>
            </div>

            {Object.keys(groupedItems).length === 0 ? (
                <div className="cart-empty">
                    <ShoppingCart size={48} className="cart-empty-icon" />
                    <h3>Seu carrinho está vazio</h3>
                    <p>Visite os grupos abertos para adicionar produtos.</p>
                    <button onClick={() => navigate('/app')} className="btn btn-primary">
                        Ver Grupos Disponíveis <ArrowRight size={16} />
                    </button>
                </div>
            ) : (
                <div className="cart-groups">
                    {Object.entries(groupedItems).map(([lotId, group]) => (
                        <div key={lotId} className="cart-group-card">
                            {/* Header do Grupo */}
                            <div className="cart-group-header">
                                <div>
                                    <h2 className="cart-group-title">{group.lot.nome}</h2>
                                    <span className={`cart-group-status ${group.lot.status === 'aberto' ? 'open' : 'closed'}`}>
                                        {group.lot.status === 'aberto' ? 'Aberto para Compras' : 'Fechado'}
                                    </span>
                                </div>
                            </div>

                            {/* Lista de Itens */}
                            <div className="cart-items-list">
                                {group.items.map(item => (
                                    <div key={item.id} className="cart-item">
                                        <div className="cart-item-image">
                                            {item.imagem1 ? (
                                                <img src={item.imagem1} alt={item.nome} />
                                            ) : (
                                                <div className="cart-item-image-placeholder">
                                                    <ShoppingCart size={24} />
                                                </div>
                                            )}
                                        </div>

                                        <div className="cart-item-info">
                                            <h3 className="cart-item-name">{item.nome}</h3>
                                            <p className="cart-item-price-unit">R$ {parseFloat(item.preco).toFixed(2)} un.</p>
                                        </div>

                                        <div className="cart-item-controls">
                                            <div className="cart-quantity-control">
                                                <button
                                                    onClick={() => updateQuantity(lotId, item.id, -1)}
                                                    className="cart-quantity-btn"
                                                    disabled={group.lot.status !== 'aberto'}
                                                    title="Diminuir quantidade"
                                                >
                                                    <Minus size={16} />
                                                </button>
                                                <span className="cart-quantity-value">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(lotId, item.id, 1)}
                                                    className="cart-quantity-btn"
                                                    disabled={group.lot.status !== 'aberto'}
                                                    title="Aumentar quantidade"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                            <span className="cart-item-total">
                                                R$ {(item.preco * item.quantity).toFixed(2)}
                                            </span>
                                            <button
                                                onClick={() => removeItem(lotId, item.id)}
                                                className="cart-item-remove"
                                                title="Remover item"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Footer Totais e Botão */}
                            <div className="cart-group-footer">
                                <div className="cart-footer-total">
                                    <span className="cart-group-total-label">Total do Grupo:</span>
                                    <span className="cart-group-total-value">R$ {group.total.toFixed(2)}</span>
                                </div>
                                {group.lot.status === 'aberto' && (
                                    <button
                                        onClick={() => handleCheckout(lotId)}
                                        disabled={checkoutLoading}
                                        className="btn-checkout"
                                    >
                                        {checkoutLoading ? (
                                            <>
                                                <FileText size={16} className="spin" /> Gerando Romaneio...
                                            </>
                                        ) : (
                                            <>
                                                Fechar Compra e Gerar Romaneio <FileText size={16} />
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
