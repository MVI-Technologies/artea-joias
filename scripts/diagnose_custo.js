import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function diagnose() {
  console.log('\n🔍 DIAGNOSING PRODUCT COSTS\n');
  
  // Check a specific product
  const testProduct = 'Brinco, Argola Dupla Ródio Cravejada Ametista - 4,4cm';
  
  const { data: product, error } = await supabase
    .from('products')
    .select('id, nome, custo')
    .eq('nome', testProduct)
    .single();
  
  if (error) {
    console.log('❌ Error fetching product:', error.message);
    return;
  }
  
  if (!product) {
    console.log('❌ Product not found');
    return;
  }
  
  console.log('📦 Product in database:');
  console.log(`   Name: ${product.nome}`);
  console.log(`   Cost: ${product.custo}`);
  console.log(`   Cost type: ${typeof product.custo}`);
  console.log(`   Cost is null: ${product.custo === null}`);
  
  // Now let's try to update it
  console.log('\n📝 Attempting to update with cost 21.95...\n');
  
  const { data: updated, error: updateError } = await supabase
    .from('products')
    .update({ custo: 21.95 })
    .eq('id', product.id)
    .select()
    .single();
  
  if (updateError) {
    console.log('❌ Update error:', updateError.message);
    console.log('Full error:', JSON.stringify(updateError, null, 2));
  } else {
    console.log('✅ Updated successfully');
    console.log(`   New cost: ${updated.custo}`);
  }
  
  // Check database schema
  console.log('\n🔍 Checking database columns...\n');
  
  const { data: products } = await supabase
    .from('products')
    .select('nome, custo, margem_pct, preco')
    .limit(3);
  
  products.forEach(p => {
    console.log(`Product: ${p.nome.substring(0, 40)}`);
    console.log(`  custo: ${p.custo} (${typeof p.custo})`);
    console.log(`  margem_pct: ${p.margem_pct}`);
    console.log(`  preco: ${p.preco}`);
    console.log('');
  });
}

diagnose();
