import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

// Lista de produtos a importar
const productsData = [
  {
    "id": 140,
    "nome": "Pulseira Kit 3",
    "descricao": "Pulseira, Kit 3 pulseira resinada multicor",
    "categoria_id": "Pulseira",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-140.jpg",
    "custo": 25.17,
    "margem_pct": null,
    "link_id": 501
  },
  {
    "id": 141,
    "nome": "Brinco Kit 3",
    "descricao": "Brinco, Kit 3 brincos Café",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-141.jpg",
    "custo": 30.65,
    "margem_pct": null,
    "link_id": 501
  },
  {
    "id": 142,
    "nome": "Bracelete Kit 2",
    "descricao": "Bracelete, Kit 2 Braceletes",
    "categoria_id": "Bracelete",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-142.jpg",
    "custo": 39.49,
    "margem_pct": null,
    "link_id": 501
  },
  {
    "id": 143,
    "nome": "Brinco Conjunto 6",
    "descricao": "Brinco, Conjunto 6 brincos",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-143.jpg",
    "custo": 26.29,
    "margem_pct": null,
    "link_id": 501
  },
  {
    "id": 144,
    "nome": "Brinco Brinco nude",
    "descricao": "Brinco, Brinco nude",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-144.jpg",
    "custo": 14.93,
    "margem_pct": null,
    "link_id": 501
  },
  {
    "id": 145,
    "nome": "Brinco Brinco Floral",
    "descricao": "Brinco, Brinco Floral Verde",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-145.jpg",
    "custo": 18.33,
    "margem_pct": null,
    "link_id": 501
  },
  {
    "id": 146,
    "nome": "Brinco Brinco marrom",
    "descricao": "Brinco, Brinco marrom",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-146.jpg",
    "custo": 12.41,
    "margem_pct": null,
    "link_id": 501
  },
  {
    "id": 147,
    "nome": "Conjunto Conjunto Flor",
    "descricao": "Conjunto, Conjunto Flor Dourado",
    "categoria_id": "Conjunto",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-147.jpg",
    "custo": 30.05,
    "margem_pct": null,
    "link_id": 501
  },
  {
    "id": 148,
    "nome": "Conjunto Conjunto Marrom",
    "descricao": "Conjunto, Conjunto Marrom",
    "categoria_id": "Conjunto",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-148.jpg",
    "custo": 37.65,
    "margem_pct": null,
    "link_id": 501
  },
  {
    "id": 149,
    "nome": "Conjunto Conjunto Branco",
    "descricao": "Conjunto, Conjunto Branco",
    "categoria_id": "Conjunto",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-149.jpg",
    "custo": 37.65,
    "margem_pct": null,
    "link_id": 501
  },
  {
    "id": 150,
    "nome": "Brinco Brinco Madreperola",
    "descricao": "Brinco, Brinco Madreperola Resinado",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-150.jpg",
    "custo": 18.20,
    "margem_pct": null,
    "link_id": 501
  },
  {
    "id": 160,
    "nome": "Colar Colar Verão",
    "descricao": "Colar, Colar Verão",
    "categoria_id": "Colar",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-160.jpg",
    "custo": 22.57,
    "margem_pct": null,
    "link_id": 501
  },
  {
    "id": 166,
    "nome": "Pulseira Pulseira Penduricalhos",
    "descricao": "Pulseira, Pulseira Penduricalhos Verão",
    "categoria_id": "Pulseira",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-166.jpg",
    "custo": 25.93,
    "margem_pct": null,
    "link_id": 501
  }
];

async function importProducts() {
  console.log('\n📦 IMPORTANDO PRODUTOS PARA LINK 501\n');
  
  try {
    // 1. Verificar/criar lote
    console.log('🔍 Verificando lote 501...');
    const { data: lot, error: lotError } = await supabase
      .from('lots')
      .select('id, nome')
      .eq('link_compra', 'link-501')
      .maybeSingle();
    
    let lotId;
    if (!lot) {
      console.log('   Lote não encontrado, criando...');
      const { data: newLot, error: createError } = await supabase
        .from('lots')
        .insert({
          nome: 'link 501 - Catálogo de Produtos',
          status: 'aberto',
          link_compra: 'link-501'
        })
        .select()
        .single();
      
      if (createError) throw createError;
      lotId = newLot.id;
      console.log(`   ✅ Lote criado: ${newLot.nome}`);
    } else {
      lotId = lot.id;
      console.log(`   ✅ Lote encontrado: ${lot.nome}`);
    }
    
    // 2. Buscar todas as categorias
    console.log('\n📋 Buscando categorias...');
    const { data: categories } = await supabase
      .from('categories')
      .select('id, nome');
    
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.nome] = cat.id;
    });
    console.log(`   ✅ ${categories.length} categorias encontradas`);
    
    // 3. Processar produtos
    let created = 0;
    let deleted = 0;
    let linked = 0;
    let categoriesCreated = 0;
    
    console.log(`\n🔄 Processando ${productsData.length} produtos...\n`);
    
    for (const item of productsData) {
      try {
        const categoryName = item.categoria_id;
        let categoryId = categoryMap[categoryName];
        
        // Criar categoria se não existir
        if (!categoryId) {
          console.log(`   🆕 Criando categoria: ${categoryName}`);
          const { data: newCategory, error: catError } = await supabase
            .from('categories')
            .insert({ nome: categoryName })
            .select()
            .single();
          
          if (catError) throw catError;
          
          categoryId = newCategory.id;
          categoryMap[categoryName] = categoryId;
          categoriesCreated++;
        }
        
        // Buscar produtos duplicados (mesmo nome ou imagem)
        const { data: duplicates } = await supabase
          .from('products')
          .select('id')
          .or(`nome.eq.${item.nome},imagem1.eq.${item.imagem1}`);
        
        // Deletar duplicados
        if (duplicates && duplicates.length > 0) {
          console.log(`   🗑️  Removendo ${duplicates.length} duplicata(s) de "${item.nome}"`);
          for (const dup of duplicates) {
            await supabase.from('products').delete().eq('id', dup.id);
            deleted++;
          }
        }
        
        // Criar produto
        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert({
            nome: item.nome,
            descricao: item.descricao,
            categoria_id: categoryId,
            imagem1: item.imagem1,
            custo: item.custo,
            margem_pct: item.margem_pct || 10, // Padrão 10% para semijoias
            ativo: true
          })
          .select()
          .single();
        
        if (createError) throw createError;
        
        created++;
        console.log(`   ✅ ${item.nome} - R$ ${item.custo}`);
        
        // Vincular ao lote
        const { error: linkError } = await supabase
          .from('lot_products')
          .insert({
            lot_id: lotId,
            product_id: newProduct.id
          });
        
        if (!linkError) {
          linked++;
        }
        
      } catch (itemError) {
        console.error(`   ❌ Erro em "${item.nome}": ${itemError.message}`);
      }
    }
    
    // Resumo
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DA IMPORTAÇÃO');
    console.log('='.repeat(60));
    console.log(`🆕 Categorias criadas: ${categoriesCreated}`);
    console.log(`🗑️  Produtos duplicados removidos: ${deleted}`);
    console.log(`✨ Produtos criados: ${created}`);
    console.log(`🔗 Produtos vinculados ao lote: ${linked}`);
    console.log(`📦 Total processado: ${productsData.length}`);
    console.log('='.repeat(60) + '\n');
    
    console.log('✅ Importação concluída com sucesso!');
    
  } catch (error) {
    console.error('\n❌ Erro na importação:', error.message);
    process.exit(1);
  }
}

importProducts();
