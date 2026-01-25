import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkLotProducts() {
  // Find lot
  const { data: lot } = await supabase
    .from('lots')
    .select('id, nome')
    .ilike('nome', '%link 502%')
    .single();
  
  if (!lot) {
    console.log('❌ Lot not found');
    return;
  }
  
  console.log(`\n📦 Checking products in: ${lot.nome}\n`);
  
  // Get products in this lot
  const { data: lotProducts } = await supabase
    .from('lot_products')
    .select('products(id, nome, custo)')
    .eq('lot_id', lot.id)
    .order('products(nome)');
  
  console.log(`Total products in lot: ${lotProducts.length}\n`);
  
  // Show sample with costs
  console.log('✅ Sample products with costs:\n');
  lotProducts.slice(0, 10).forEach(lp => {
    const p = lp.products;
    console.log(`- ${p.nome.substring(0, 50).padEnd(52)} R$ ${p.custo}`);
  });
  
  // Check for products with no cost
  const noCost = lotProducts.filter(lp => !lp.products.custo || lp.products.custo === 0);
  
 if (noCost.length > 0) {
    console.log(`\n⚠️  ${noCost.length} products in lot with null/zero costs:`);
    noCost.forEach(lp => console.log(`- ${lp.products.nome}`));
  } else {
    console.log(`\n✅ All ${lotProducts.length} products in lot have valid costs!`);
  }
  
  // Calculate price range
  const costs = lotProducts.map(lp => parseFloat(lp.products.custo)).filter(c => c > 0);
  if (costs.length > 0) {
    console.log(`\n💰 Price range: R$ ${Math.min(...costs).toFixed(2)} - R$ ${Math.max(...costs).toFixed(2)}`);
  }
}

checkLotProducts();
