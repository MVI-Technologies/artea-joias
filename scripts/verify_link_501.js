import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function verifyImport() {
  console.log('\n📊 VERIFICANDO IMPORTAÇÃO - LINK 501\n');
  
  try {
    // Buscar lote
    const { data: lot } = await supabase
      .from('lots')
      .select('id, nome')
      .eq('link_compra', 'link-501')
      .single();
    
    if (!lot) {
      console.log('❌ Lote não encontrado!');
      return;
    }
    
    console.log(`📦 Lote: ${lot.nome}\n`);
    
    // Buscar produtos do lote
    const { data: lotProducts, count } = await supabase
      .from('lot_products')
      .select('products(id, nome, custo, margem_pct, categoria_id, categories(nome))', { count: 'exact' })
      .eq('lot_id', lot.id);
    
    console.log(`✅ Total de produtos no lote: ${count}\n`);
    
    if (lotProducts && lotProducts.length > 0) {
      console.log('Produtos cadastrados:\n');
      lotProducts.forEach((lp, index) => {
        const p = lp.products;
        const expectedPrice = (parseFloat(p.custo) * (1 + parseFloat(p.margem_pct) / 100)).toFixed(2);
        console.log(`${(index + 1).toString().padStart(2)}. ${p.nome}`);
        console.log(`    Categoria: ${p.categories?.nome || 'N/A'}`);
        console.log(`    Custo: R$ ${p.custo} | Margem: ${p.margem_pct}% | Preço esperado: R$ ${expectedPrice}\n`);
      });
    }
    
    // Resumo por categoria
    const categoryCounts = {};
    lotProducts.forEach(lp => {
      const catName = lp.products.categories?.nome || 'Sem categoria';
      categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
    });
    
    console.log('📋 Resumo por categoria:');
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count} produto(s)`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

verifyImport();
