# Preços mudando sozinhos entre grupos — diagnóstico e plano

> **Status: aguardando decisão.** Nada aqui foi implementado. Documento
> escrito para embasar a conversa com a cliente antes de executar.

## O relato

> "acontecia de algum grupo estar em aberto e quando eu fosse atualizar o
> romaneio e a peça estava com preços diferentes, eles mudavam os preços
> sozinhos."

A pergunta que veio junto ("se eu duplicar um link ele vai prejudicar os
outros que estão em aberto?") tem uma resposta mais sutil do que "não":
**duplicar, por si só, não altera preço nenhum — mas cria a condição para
que a próxima edição de preço altere os dois links de uma vez.**

## Como o preço muda sozinho (mecanismo confirmado)

São três fatores que só causam o problema quando combinados.

### 1. Duplicar um link faz os dois links apontarem para o MESMO produto

`src/pages/admin/lots/LotDetail.jsx:688-725` (`duplicateLot`) copia os
produtos assim:

```js
const newLotProducts = products.map(lp => ({
  lot_id: data.id,
  product_id: lp.product_id,   // <<< mesma linha de products, não uma cópia
  ...
}))
```

Ou seja: não existe "o produto do link A" e "o produto do link B". Existe
**um** produto no catálogo, referenciado pelos dois links via
`lot_products`. Não há nenhuma coluna de preço em `lot_products`.

> Obs.: `src/pages/admin/lots/LotList.jsx:269-298` tem uma segunda função de
> duplicar que **não copia produto nenhum**, embora o modal
> (`LotList.jsx:635`) prometa "Será criada uma cópia com todos os produtos".
> Inconsistência a corrigir junto.

### 2. Editar o preço grava no catálogo global, sem escopo de link

`src/pages/admin/lots/LotDetail.jsx:811-863`:

```js
custo: (() => {
  const targetPrice = parseFloat(productForm.preco);
  const margin = editingProduct?.margem_pct || 10;
  return targetPrice / (1 + margin / 100);
})(),
...
await supabase.from('products').update(productData).eq('id', editingProduct.id)
```

Não há `lot_id` nenhum nesse `update`. Confirmado no banco: `products.preco`
é coluna **GENERATED**:

```
preco = custo * (1 + COALESCE(margem_pct, 10) / 100)
```

Então mexer no `custo` (que é o que a tela faz) reprecifica o produto em
**todos** os links que o contêm, inclusive os já fechados. A tela não dá
nenhum aviso de que o produto é compartilhado.

### 3. Abrir "Editar Quantidades" reescreve o preço histórico do romaneio

`src/pages/admin/romaneios/RomaneioDetail.jsx:360-375` (`enableEditMode`):

```js
// Recalculate prices for ALL existing items using current lot margins.
setEditedItems(items.map(item => {
  const precoCalculado = calcPrecoClienteNoLote(item.product, lot)
  return { ...item, preco_unitario: precoCalculado, /* ... */ }
}))
```

`calcPrecoClienteNoLote` lê o preço **atual** do produto e as porcentagens
**atuais** do lote. E `saveChanges` (`:476-535`) grava esse valor por cima de
`romaneio_items.preco_unitario`.

Resultado: **só de abrir "Editar Quantidades" e salvar**, todos os preços
combinados do romaneio são substituídos pelos preços de hoje — exatamente o
que a cliente descreveu.

O schema, aliás, está certo: `romaneio_items.preco_unitario`
(`supabase/migrations/030_remove_orders_table.sql:7-16`) É o snapshot
histórico. Quem o destrói é o aplicativo, não o banco.

### Resumindo a sequência

1. Admin duplica um link → os dois passam a apontar para o mesmo produto.
2. Admin ajusta o preço no link novo → o preço muda também no link antigo,
   que continua aberto.
3. Admin abre o romaneio do link antigo para conferir quantidades → os
   preços combinados são substituídos pelos novos ao salvar.

## Plano aprovado (a executar depois da conversa)

### Parte 1 — Congelar o preço do romaneio (menor risco, resolve o sintoma)

- `enableEditMode` passa a **preservar** o `preco_unitario` já gravado;
  o recálculo fica só para itens novos adicionados ao romaneio.
- `saveChanges` para de reescrever `preco_unitario` de itens existentes.
- Adicionar um botão explícito **"Recalcular preços"**, para quando a
  atualização for intencional — com confirmação, já que é destrutivo.

### Parte 2 — Isolar o preço por link (resolve a causa raiz)

- Nova coluna de preço em `lot_products` (o preço daquele produto **naquele
  link**), com migration de backfill a partir do preço atual.
- `products` passa a ser catálogo/custo base; a tela de produto do lote
  escreve no preço do link, não no catálogo global.
- `calcPrecoClienteNoLote` (`src/utils/pricing.js`) passa a considerar o
  preço do link quando existir.
- Impacto a mapear antes: catálogo do cliente, carrinho, checkout, romaneio,
  relatórios e importação de produtos.

## Achados extras encontrados no caminho

Itens que apareceram na investigação e valem decisão à parte:

1. **Trigger global de margem armado em produção.**
   `apply_margin_on_lot_update` → `apply_lot_margin_to_products`
   (`supabase/migrations/022_business_logic_automation.sql:179-214`) está
   ativo no banco. Se alguém preencher `lots.margem_fixa_pct`, ele roda
   `UPDATE products SET margem_pct = ..., preco = ...` para **todo** produto
   do lote, sem escopo. Dois problemas:
   - é uma reprecificação global em massa;
   - como `preco` é coluna GENERATED, o `SET preco = ...` **falha com erro**,
     derrubando o salvamento do lote inteiro.

   Hoje nenhuma tela escreve `margem_fixa_pct` (só via SQL/Studio), então
   não é a causa atual — é uma mina terrestre. Recomendação: derrubar ou
   reescrever o trigger.

2. **Excluir variação apaga o produto de todos os links.**
   `LotDetail.jsx:979-1013` (`deleteVariation`) executa
   `DELETE FROM products WHERE id = productId` depois de remover o vínculo
   com o link atual.

3. **Divergência entre as migrations do repo e o banco.** Verificado: a
   constraint de `lots.status` em produção era a da migration `039`, não a da
   `071`; e a `011` (que dropava a expressão de `products.preco`) também não
   está aplicada — no banco, `preco` segue GENERATED. Vale um levantamento de
   quais migrations do repo realmente rodaram.

4. **Motor de faixas morto.** `src/utils/dynamicFee.js` implementa um sistema
   completo de faixas e não é chamado em lugar nenhum; o campo que ele
   alimentaria (`lots.taxa_separacao_dinamica`) é escrito por
   `LotForm.jsx:490` e nunca lido. Candidato a remoção — ou a virar a base de
   uma configuração de faixas por lote, caso a cliente queira isso no futuro.
