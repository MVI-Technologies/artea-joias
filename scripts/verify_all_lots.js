import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function verifyAll() {
  console.log('\n📊 RESUMO GERAL DE PRODUTOS POR LOTE\n');
  
  const lots = [
    { link: 'link-501', nome: 'Link 501' },
    { link: 'link-502', nome: 'Link 502' },
    { link: 'link-503', nome: 'Link 503' }
  ];
  
  for (const lotInfo of lots) {
    const { data: lot } = await supabase
      .from('lots')
      .select('id, nome')
      .eq('link_compra', lotInfo.link)
      .single();
    
    if (lot) {
      const { count } = await supabase
        .from('lot_products')
        .select('*', { count: 'exact' })
        .eq('lot_id', lot.id);
      
      console.log(`📦 ${lot.nome}`);
      console.log(`   Produtos: ${count || 0}\n`);
    }
  }
  
  // Total geral
  const { count: totalProducts } = await supabase
    .from('products')
    .select('*', { count: 'exact' });
  
  const { count: totalCategories } = await supabase
    .from('categories')
    .select('*', { count: 'exact' });
  
  console.log('='.repeat(50));
  console.log(`✅ Total de Produtos: ${totalProducts}`);
  console.log(`📋 Total de Categorias: ${totalCategories}`);
  console.log('='.repeat(50));
}

verifyAll();
