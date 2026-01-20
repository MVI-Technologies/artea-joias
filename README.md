O sistema Artea Joias é uma plataforma B2C de vendas de semijoias, operando principalmente no modelo de compras coletivas por grupo (link). Existe apenas uma empresa vendedora, não há marketplace nem múltiplos lojistas. Todos os produtos, preços e regras são definidos exclusivamente pela administradora do sistema.

Os produtos são cadastrados com custo interno oculto e uma margem percentual configurável, que gera automaticamente o preço final exibido ao cliente. O cliente nunca visualiza custo, margem ou lucro, apenas o valor final do produto. Os produtos podem ser vendidos de forma unitária (1–1) ou em pacotes de quantidade mínima (ex.: 12, 24 unidades do mesmo modelo).

As vendas coletivas funcionam por meio de grupos de compra, chamados de links ou catálogos. Cada link representa um grupo independente, com data de abertura, data de encerramento e regras próprias. Um grupo pode ser fechado automaticamente ao atingir a quantidade mínima necessária ou ao chegar à data limite, o que ocorrer primeiro.

Durante o período em que o grupo está aberto, os clientes aprovados podem acessar o link, escolher produtos e informar a quantidade desejada. O sistema soma automaticamente as quantidades compradas por todos os clientes. Quando o grupo é fechado, nenhuma nova compra é permitida naquele link.

Após o fechamento do grupo, o sistema gera automaticamente os romaneios, que são listas organizadas por cliente contendo os produtos e quantidades compradas. O romaneio é utilizado pela administradora para separação física, conferência, embalagem e envio das mercadorias.

O fluxo de status segue uma sequência clara e controlada: Aberto → Fechado → Em Separação → Pago → Enviado → Concluído. Esses status são visíveis para o cliente e controlados pela administradora. O cliente acompanha todo o andamento do seu pedido, mas não pode alterar nenhum estado.

Os pagamentos são realizados fora da plataforma, via Pix ou link do Mercado Pago, geralmente enviados ao cliente por WhatsApp. O sistema não processa pagamentos diretamente, apenas registra o status de pagamento após confirmação manual ou via webhook. O valor do frete é calculado individualmente para cada cliente, utilizando integração com os Correios, após o fechamento do grupo.

O acesso ao sistema é feito por telefone e senha, e todo cliente precisa ser aprovado manualmente pela administradora antes de poder comprar. Clientes podem ser bloqueados ou desbloqueados a qualquer momento. O sistema mantém histórico de compras, aniversários, volume de pedidos e identifica clientes recorrentes com indicadores visuais (ex.: estrelinhas).

A plataforma envia notificações automáticas via WhatsApp, integradas à Evolution API, informando eventos importantes como abertura de grupo, fechamento, confirmação de pagamento e envio de pedidos. Essas mensagens seguem uma lógica automática, mas o contato humano via WhatsApp continua sendo parte do processo comercial.

Por fim, o sistema fornece relatórios gerenciais, como vendas mensais, produtos mais vendidos, clientes que mais compram, faturamento por grupo e aniversariantes. O objetivo do sistema é organizar, automatizar e escalar o modelo de compras coletivas de semijoias, mantendo o controle operacional simples e o entendimento fácil para o cliente final.
