import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

// Lista de produtos para link 504
const productsData = [
  {
    "id": 322,
    "nome": "Brinco Brinco Folha",
    "descricao": "Brinco, Brinco Folha",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-322.jpeg",
    "custo": 3.52,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 323,
    "nome": "Brinco Brinco Pai",
    "descricao": "Brinco, Brinco Pai Nosso Pequeno",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-323.jpeg",
    "custo": 3.5,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 328,
    "nome": "Brinco Brinco Corrente",
    "descricao": "Brinco, Brinco Corrente",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-328.jpeg",
    "custo": 3.5,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 329,
    "nome": "Brinco Borboleta",
    "descricao": "Brinco, Borboleta",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-329.jpeg",
    "custo": 3.5,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 330,
    "nome": "Brinco Malha",
    "descricao": "Brinco, Malha",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-330.jpeg",
    "custo": 4.99,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 331,
    "nome": "Brinco Brinco botão",
    "descricao": "Brinco, Brinco botão",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-331.jpeg",
    "custo": 3.48,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 332,
    "nome": "Brinco Brinco argola",
    "descricao": "Brinco, Brinco argola",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-332.jpeg",
    "custo": 3.5,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 333,
    "nome": "Pulseira Pulseira Corrente",
    "descricao": "Pulseira, Pulseira Corrente Coração",
    "categoria_id": "Pulseira",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-333.jpeg",
    "custo": 7.99,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 334,
    "nome": "Pulseira Pulseira Corrente",
    "descricao": "Pulseira, Pulseira Corrente Serpente",
    "categoria_id": "Pulseira",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-334.jpeg",
    "custo": 7.99,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 335,
    "nome": "Brinco Brinco coração",
    "descricao": "Brinco, Brinco coração torcido",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-335.jpeg",
    "custo": 3.52,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 336,
    "nome": "Brinco Brinco folhas",
    "descricao": "Brinco, Brinco folhas",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-336.jpeg",
    "custo": 3.55,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 337,
    "nome": "Brinco Brinco Flor",
    "descricao": "Brinco, Brinco Flor",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-337.jpeg",
    "custo": 3.49,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 338,
    "nome": "Brinco Brinco Elos",
    "descricao": "Brinco, Brinco Elos",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-338.jpeg",
    "custo": 3.62,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 339,
    "nome": "Colar Colar Corrente",
    "descricao": "Colar, Colar Corrente Pingente 1 meninq",
    "categoria_id": "Colar",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-339.jpeg",
    "custo": 10.99,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 340,
    "nome": "Colar Colar Corrente",
    "descricao": "Colar, Colar Corrente Pingente 1 menino",
    "categoria_id": "Colar",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-340.jpeg",
    "custo": 10.99,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 341,
    "nome": "Colar Colar Corrente",
    "descricao": "Colar, Colar Corrente Pingente 2 meninas",
    "categoria_id": "Colar",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-341.jpeg",
    "custo": 11.49,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 342,
    "nome": "Colar Colar Corrente",
    "descricao": "Colar, Colar Corrente Pingente 2 meninos",
    "categoria_id": "Colar",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-342.jpeg",
    "custo": 11.49,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 343,
    "nome": "Colar Colar Corrente",
    "descricao": "Colar, Colar Corrente Pingente Filhos",
    "categoria_id": "Colar",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-343.jpeg",
    "custo": 13.99,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 344,
    "nome": "Colar",
    "descricao": "Colar",
    "categoria_id": "Colar",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-344.jpeg",
    "custo": 9.99,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 345,
    "nome": "Pulseira Pulseira Corrente",
    "descricao": "Pulseira, Pulseira Corrente Pingente Filhos",
    "categoria_id": "Pulseira",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-345.jpeg",
    "custo": 10.99,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 346,
    "nome": "Colar Colar Corrente",
    "descricao": "Colar, Colar Corrente Inicial Nome",
    "categoria_id": "Colar",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-346.jpeg",
    "custo": 11.02,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 347,
    "nome": "Colar Colar Espírito",
    "descricao": "Colar, Colar Espírito Santo Fundo Preto",
    "categoria_id": "Colar",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-347.jpeg",
    "custo": 11.29,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 348,
    "nome": "Colar Colar corrente",
    "descricao": "Colar, Colar corrente gratidão rose",
    "categoria_id": "Colar",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-348.jpeg",
    "custo": 11.29,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 349,
    "nome": "Colar Colar corrente",
    "descricao": "Colar, Colar corrente gratidão preto",
    "categoria_id": "Colar",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-349.jpeg",
    "custo": 11.29,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 350,
    "nome": "Colar Colar Espírito",
    "descricao": "Colar, Colar Espírito Santo Fundo Branco",
    "categoria_id": "Colar",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-350.jpeg",
    "custo": 11.29,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 351,
    "nome": "Colar Colar Corrente",
    "descricao": "Colar, Colar Corrente Coração",
    "categoria_id": "Colar",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-351.jpeg",
    "custo": 10.99,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 352,
    "nome": "Colar Colar Corrente",
    "descricao": "Colar, Colar Corrente Pai Nosso",
    "categoria_id": "Colar",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-352.jpeg",
    "custo": 11.02,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 353,
    "nome": "Brinco Brinco Meio",
    "descricao": "Brinco, Brinco Meio Folhas",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-353.jpeg",
    "custo": 3.52,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 354,
    "nome": "Brinco Brinco Estrela",
    "descricao": "Brinco, Brinco Estrela Do Mar",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-354.jpeg",
    "custo": 4.5,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 355,
    "nome": "Brinco Brinco 2",
    "descricao": "Brinco, Brinco 2 borboletas",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-355.jpeg",
    "custo": 3.5,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 356,
    "nome": "Brinco Brinco Gota",
    "descricao": "Brinco, Brinco Gota Riscada",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-356.jpeg",
    "custo": 3.59,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 357,
    "nome": "Brinco Brinco Serpente",
    "descricao": "Brinco, Brinco Serpente",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-357.jpeg",
    "custo": 3.59,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 358,
    "nome": "Brinco Brinco leque",
    "descricao": "Brinco, Brinco leque",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-358.jpeg",
    "custo": 3.99,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 359,
    "nome": "Brinco Brinco pétalas",
    "descricao": "Brinco, Brinco pétalas",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-359.jpeg",
    "custo": 3.5,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 360,
    "nome": "Brinco Brinco Flor",
    "descricao": "Brinco, Brinco Flor G",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-360.jpeg",
    "custo": 3.5,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 361,
    "nome": "Brinco Brinco redondo",
    "descricao": "Brinco, Brinco redondo vazado torcido",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-361.jpeg",
    "custo": 3.49,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 362,
    "nome": "Brinco Brinco coração",
    "descricao": "Brinco, Brinco coração aro",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-362.jpeg",
    "custo": 3.51,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 363,
    "nome": "Brinco Brinco Flor",
    "descricao": "Brinco, Brinco Flor",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-363.jpeg",
    "custo": 3.5,
    "margem_pct": null,
    "link_id": 504
  },
  {
    "id": 364,
    "nome": "Brinco Brinco elos",
    "descricao": "Brinco, Brinco elos triplos",
    "categoria_id": "Brinco",
    "imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-364.jpeg",
    "custo": 3.69,
    "margem_pct": null,
    "link_id": 504
  }
];

async function importProducts() {
  console.log('\n📦 IMPORTANDO PRODUTOS PARA LINK 504\n');
  
  try {
    // 1. Verificar/criar lote
    console.log('🔍 Verificando lote 504...');
    const { data: lot } = await supabase
      .from('lots')
      .select('id, nome')
      .eq('link_compra', 'link-504')
      .maybeSingle();
    
    let lotId;
    if (!lot) {
      console.log('   Criando lote...');
      const { data: newLot, error: createError } = await supabase
        .from('lots')
        .insert({
          nome: 'link 504 - Saldão',
          status: 'aberto',
          link_compra: 'link-504'
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
    
    // 2. Buscar categorias
    const { data: categories } = await supabase.from('categories').select('id, nome');
    const categoryMap = {};
    categories.forEach(cat => { categoryMap[cat.nome] = cat.id; });
    
    // 3. Processar produtos
    let created = 0, deleted = 0, linked = 0, categoriesCreated = 0;
    
    console.log(`\n🔄 Processando ${productsData.length} produtos...\n`);
    
    for (const item of productsData) {
      try {
        const categoryName = item.categoria_id;
        let categoryId = categoryMap[categoryName];
        
        if (!categoryId) {
          const { data: newCategory } = await supabase
            .from('categories')
            .insert({ nome: categoryName })
            .select()
            .single();
          categoryId = newCategory.id;
          categoryMap[categoryName] = categoryId;
          categoriesCreated++;
        }
        
        const { data: duplicates } = await supabase
          .from('products')
          .select('id')
          .or(`nome.eq.${item.descricao},imagem1.eq.${item.imagem1}`);
        
        if (duplicates?.length > 0) {
          for (const dup of duplicates) {
            await supabase.from('products').delete().eq('id', dup.id);
            deleted++;
          }
        }
        
        const { data: newProduct } = await supabase
          .from('products')
          .insert({
            nome: item.descricao,
            descricao: item.descricao,
            categoria_id: categoryId,
            imagem1: item.imagem1,
            custo: item.custo,
            margem_pct: item.margem_pct || 10,
            ativo: true
          })
          .select()
          .single();
        
        created++;
        console.log(`   ✅ ${item.descricao.substring(0, 50)}... - R$ ${item.custo}`);
        
        await supabase.from('lot_products').insert({
          lot_id: lotId,
          product_id: newProduct.id
        });
        linked++;
        
      } catch (itemError) {
        console.error(`   ❌ Erro: ${itemError.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO');
    console.log('='.repeat(60));
    console.log(`🆕 Categorias criadas: ${categoriesCreated}`);
    console.log(`🗑️  Duplicados removidos: ${deleted}`);
    console.log(`✨ Produtos criados: ${created}`);
    console.log(`🔗 Vinculados ao lote: ${linked}`);
    console.log(`📦 Total processado: ${productsData.length}`);
    console.log('='.repeat(60) + '\n');
    
    console.log('✅ Importação concluída!');
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    process.exit(1);
  }
}

importProducts();
