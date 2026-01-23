# Implementação da Área do Cliente

## Fase 1: Fundação & Layout ✅
- [x] Criar Rotas `/app`, `/app/carrinho`, `/app/historico`, `/app/perfil`
- [x] Criar componente `ClientLayout` (Menu responsivo conforme referência)
- [x] Definir Design Tokens (Cores, Badges) no CSS

## Fase 2: Compras Coletivas (Links) ✅
- [x] Componente `ClientLinks` (Listagem)
- [x] Componente `LinkCard` (Visual: Imagem, Valor, Progresso)
- [x] Lógica de Query: Filtrar apenas links `abertos` e `publicos`

## Fase 3: Carrinho & Checkout ✅
- [x] Contexto `CartContext` (Simulado via LocalStorage - Funcional)
- [x] Tela `Cart` (Agrupado por Link)
- [x] Checkout: Criar `orders` no Supabase
- [x] Validação: Verificar se link ainda está aberto antes de fechar pedido

## Fase 4: Histórico & Romaneios 🚧
- [x] Tela `OrderHistory`
- [x] Badges de Status (Lógica visual)
- [ ] Integração com Edge Function para PDF (Próximo Passo)

## Fase 5: Edge Function
- [ ] Criar function `generate-romaneio`
- [ ] Gerar PDF com `pdf-lib` (layout profissional)

## Fase 6: Perfil & RLS
- [ ] Tela `MyData`
- [ ] Revisão final de RLS (Policies)
