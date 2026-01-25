import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function verifyAllLots() {
  console.log('\n📊 VERIFICAÇÃO FINAL DE IMPORTAÇÃO DOS LOTES\n');
  
  const lotLinks = ['link-501', 'link-502', 'link-503', 'link-504'];
  
  for (const link of lotLinks) {
    const { data: lot } = await supabase
      .from('lots')
      .select('id, nome, link_compra')
      .eq('link_compra', link)
      .maybeSingle();
    
    if (lot) {
      const { count } = await supabase
        .from('lot_products')
        .select('*', { count: 'exact' })
        .eq('lot_id', lot.id);
        
      console.log(`✅ ${lot.nome.padEnd(40)} (Link: ${lot.link_compra})`);
      console.log(`   📦 Produtos vinculados: ${count}`);
      
      // Check total products created with this link_id in metadata (if we had stored it, but we didn't store link_id in product table, just linked via lot_products)
      // We can check if costs look consistent
      const { data: sample } = await supabase
        .from('lot_products')
        .select('products(custo, margem_pct)')
        .eq('lot_id', lot.id)
        .limit(1);
        
      if (sample && sample.length > 0) {
         console.log(`   💰 Exemplo de custo: R$ ${sample[0].products.custo} (Margem: ${sample[0].products.margem_pct}%)`);
      }
      console.log('---');
    } else {
      console.log(`❌ Lote não encontrado para ${link}`);
    }
  }
  
  // Total stats
  const { count: totalProds } = await supabase.from('products').select('*', { count: 'exact' });
  const { count: totalCats } = await supabase.from('categories').select('*', { count: 'exact' });
  
  console.log(`\n📈 TOTAIS DO SISTEMA:`);
  console.log(`   Produtos: ${totalProds}`);
  console.log(`   Categorias: ${totalCats}`);
}

verifyAllLots();
