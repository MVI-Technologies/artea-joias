import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkCosts() {
  const { data: products } = await supabase
    .from('products')
    .select('nome, custo')
    .ilike('nome', '%Argola Dupla%')
    .order('nome');
  
  console.log('\n✅ Sample products with costs:\n');
  products.forEach(p => {
    console.log(`- ${p.nome.substring(0, 50).padEnd(50)} = R$ ${p.custo}`);
  });
  
  // Check if any products have null or zero costs
  const { data: allProducts, count } = await supabase
    .from('products')
    .select('nome, custo', { count: 'exact' })
    .or('custo.is.null,custo.eq.0');
  
  console.log(`\n📊 Products with null/zero costs: ${count}`);
  
  if (count > 0) {
    console.log('\n⚠️  Products needing cost update:');
    allProducts.slice(0, 5).forEach(p => console.log(`- ${p.nome.substring(0, 50)}`));
    if (count > 5) console.log(`  ... and ${count - 5} more`);
  } else {
    console.log('\n✅ All products have valid costs!');
  }
}

checkCosts();
