# Artea Joias - Sistema de Compras Coletivas

Sistema B2C de vendas de semijoias operando no modelo de compras coletivas por grupo (link). Plataforma completa para gerenciamento de vendas, pedidos, romaneios e relatórios gerenciais.

## 📋 Sobre o Sistema

O sistema Artea Joias é uma plataforma B2C de vendas de semijoias, operando principalmente no modelo de compras coletivas por grupo (link). Existe apenas uma empresa vendedora, não há marketplace nem múltiplos lojistas. Todos os produtos, preços e regras são definidos exclusivamente pela administradora do sistema.

Os produtos são cadastrados com custo interno oculto e uma margem percentual configurável, que gera automaticamente o preço final exibido ao cliente. O cliente nunca visualiza custo, margem ou lucro, apenas o valor final do produto. Os produtos podem ser vendidos de frma unitária (1–1) ou em pacotes de quantidade mínima (ex.: 12, 24 unidades do mesmo modelo).

## 🚀 Funcionalidades 

### Para Administradores
- **Gestão de Produtos**: Cadastro de produtos com custo interno, margem e preço final automático
- **Grupos de Compra**: Criação e gerenciamento de links/catálogos com datas de abertura e encerramento
- **Controle de Pedidos**: Acompanhamento completo do fluxo de pedidos (Aberto → Fechado → Em Separação → Pago → Enviado → Concluído)
- **Romaneios**: Geração automática de romaneios PDF organizados por cliente após fechamento do grupo
- **Gestão de Clientes**: Aprovação, bloqueio e acompanhamento de histórico de compras
- **Relatórios Gerenciais**: 
  - Financeiro diário
  - Ranking de produtos e clientes
  - Aniversariantes
  - Vales-presente
  - Cliques por cliente em catálogos
- **Integrações**: Correios (cálculo de frete), Mercado Pago (pagamentos), WhatsApp (notificações)

### Para Clientes
- **Acesso via Link**: Acesso aos catálogos através de links únicos
- **Carrinho de Compras**: Seleção de produtos e quantidades desejadas
- **Acompanhamento**: Visualização do status dos pedidos em tempo real
- **Histórico**: Consulta de pedidos anteriores
- **Perfil**: Gerenciamento de dados pessoais

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 18 + Vite
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Autenticação**: Supabase Auth
- **Estilização**: CSS Custom Properties
- **Ícones**: Lucide React
- **PDF**: pdf-lib (via Edge Functions)
- **Integrações**:
  - Correios API (frete)
  - Mercado Pago (pagamentos)
  - Evolution API (WhatsApp)

## 📦 Instalação

### Pré-requisitos
- Node.js 20.19+ ou 22.12+
- npm ou yarn
- Conta no Supabase
- Git

### Passos

1. **Clone o repositório**
```bash
git clone <repository-url>
cd artea-joias
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais do Supabase:
```env
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
```

4. **Execute as migrations no Supabase**
Acesse o Supabase Dashboard → SQL Editor e execute as migrations na ordem numérica:
- `001_initial_schema.sql`
- `004_sync_role_to_metadata.sql`
- `005_rls_products_categories.sql`
- `006_phase1_complete_structure.sql`
- ... (continue com todas as migrations em ordem)

**Importante**: Execute todas as migrations em ordem para garantir que o banco de dados esteja configurado corretamente.

5. **Configure as Edge Functions (opcional)**
Se precisar das funcionalidades de PDF e integrações:
```bash
supabase functions deploy generate-romaneio-pdf
supabase functions deploy mercadopago
supabase functions deploy send-whatsapp
```

6. **Inicie o servidor de desenvolvimento**
```bash
npm run dev
```

7. **Acesse a aplicação**
Abra [http://localhost:5173](http://localhost:5173) no navegador

## 📁 Estrutura do Projeto

```
artea-joias/
├── src/
│   ├── components/          # Componentes reutilizáveis
│   │   ├── common/          # Componentes comuns (Toast, ImageUpload)
│   │   └── layout/          # Componentes de layout (Header, Sidebar)
│   ├── pages/               # Páginas da aplicação
│   │   ├── admin/           # Páginas administrativas
│   │   │   ├── clients/     # Gestão de clientes
│   │   │   ├── products/    # Gestão de produtos
│   │   │   ├── lots/       # Gestão de grupos de compra
│   │   │   ├── orders/     # Gestão de pedidos
│   │   │   ├── romaneios/  # Gestão de romaneios
│   │   │   ├── reports/    # Relatórios gerenciais
│   │   │   └── ...
│   │   ├── client/         # Páginas do cliente
│   │   │   ├── Catalog.jsx # Visualização de catálogo
│   │   │   ├── Cart.jsx    # Carrinho de compras
│   │   │   └── ...
│   │   └── auth/          # Páginas de autenticação
│   ├── contexts/           # Contextos React (AuthContext)
│   ├── hooks/              # Custom hooks (useIntegrations)
│   ├── lib/                # Bibliotecas (supabase.js)
│   ├── services/           # Serviços de integração
│   │   ├── integrations/   # Integrações (Correios, Mercado Pago, PIX)
│   │   └── whatsapp.js     # Serviço de WhatsApp
│   └── utils/              # Funções utilitárias (excelImport)
├── supabase/
│   ├── migrations/         # Migrations do banco de dados (001-034)
│   ├── functions/         # Edge Functions (Deno)
│   │   ├── generate-romaneio-pdf/  # Geração de PDF
│   │   ├── mercadopago/           # Webhook Mercado Pago
│   │   └── send-whatsapp/         # Envio de WhatsApp
│   └── scripts/            # Scripts SQL auxiliares
└── public/                 # Arquivos estáticos (logo, favicon)
```

## 🗄️ Estrutura do Banco de Dados

### Tabelas Principais
- `clients`: Clientes do sistema (com autenticação e aprovação)
- `products`: Produtos cadastrados (com custo interno e margem)
- `categories`: Categorias de produtos
- `lots`: Grupos de compra (catálogos/links)
- `lot_products`: Produtos associados a cada grupo
- `orders`: Pedidos realizados pelos clientes
- `romaneios`: Romaneios gerados após fechamento do grupo
- `gift_cards`: Vales-presente criados na tela de marketing
- `catalog_clicks`: Rastreamento de cliques em catálogos
- `whatsapp_messages`: Histórico de mensagens enviadas

### Views e Funções
- `report_financial_daily`: View para relatório financeiro diário
- Funções para cálculo de frete e geração de PDFs

## 🔐 Autenticação e Segurança

- Autenticação via telefone e senha
- Aprovação manual de clientes pela administradora
- Row Level Security (RLS) configurado em todas as tabelas
- Controle de acesso baseado em roles (admin/cliente)

## 📊 Fluxo de Vendas

1. **Criação do Grupo**: Administradora cria um grupo de compra com produtos, datas e regras
2. **Abertura**: Grupo fica disponível para clientes aprovados
3. **Compras**: Clientes acessam o link, escolhem produtos e adicionam ao carrinho
4. **Fechamento**: Grupo fecha automaticamente ao atingir quantidade mínima ou data limite
5. **Romaneio**: Sistema gera romaneios PDF organizados por cliente
6. **Separação**: Administradora separa produtos conforme romaneio
7. **Pagamento**: Cliente realiza pagamento via Pix/Mercado Pago
8. **Envio**: Administradora marca como enviado após postagem
9. **Conclusão**: Pedido é marcado como concluído

## 📱 Integrações

### Correios
- Cálculo automático de frete por cliente após fechamento do grupo
- Integração via API dos Correios

### Mercado Pago
- Geração de links de pagamento
- Webhook para confirmação automática de pagamento

### WhatsApp
- Notificações automáticas via Evolution API
- Mensagens para: abertura de grupo, fechamento, confirmação de pagamento, envio

## 📈 Relatórios

O sistema oferece diversos relatórios gerenciais:
- **Financeiro Diário**: Receita e pedidos por dia
- **Ranking de Produtos**: Produtos mais vendidos
- **Ranking de Clientes**: Clientes que mais compram
- **Aniversariantes**: Clientes com aniversário no mês atual
- **Vales**: Gestão de vales-presente
- **Cliques por Cliente**: Rastreamento de acesso aos catálogos

## 🚀 Deploy

### Frontend
O frontend pode ser deployado em qualquer serviço de hospedagem estática:
- Vercel
- Netlify
- GitHub Pages
- AWS S3 + CloudFront

### Backend
O backend utiliza Supabase, que já fornece:
- Banco de dados PostgreSQL
- Edge Functions (Deno)
- Autenticação
- Storage

## 📝 Scripts Disponíveis

```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Gera build de produção
npm run preview      # Preview do build de produção
npm run lint         # Executa linter
```

## 🤝 Contribuindo

Este é um projeto privado. Para sugestões ou problemas, entre em contato com a administradora do sistema.

## 📄 Licença

Proprietário - Artea Joias

---

**Desenvolvido com ❤️ para Artea Joias**
