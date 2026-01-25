import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fixPrecoColumn() {
  console.log('\n🔧 FIXING PRECO COLUMN\n');
  
  // First, let's check the current column definition
  console.log('Checking current column definition...\n');
  
  // Test calculation manually
  const { data: testProduct } = await supabase
    .from('products')
    .select('id, nome, custo, margem_pct, preco')
    .eq('nome', 'Brinco, Argola Dupla Ródio Cravejada Ametista - 4,4cm')
    .single();
  
  if (testProduct) {
    console.log('Current product state:');
    console.log(`  Custo: ${testProduct.custo}`);
    console.log(`  Margem: ${testProduct.margem_pct}%`);
    console.log(`  Preço (atual): ${testProduct.preco}`);
    
    const expectedPreco = parseFloat(testProduct.custo) * (1 + parseFloat(testProduct.margem_pct) / 100);
    console.log(`  Preço (esperado): ${expectedPreco.toFixed(2)}\n`);
  }
  
  // The issue is that the GENERATED column might not be working
  // Let's run a SQL command to recreate it
  console.log('Attempting to fix the preco column...\n');
  
  // We need to use RPC or a direct SQL command
  // Since we can't run DDL directly via Supabase JS client easily,
  // let's create a migration file instead
  
  console.log('⚠️  The preco column needs to be recreated.');
  console.log('Please run the following SQL in your Supabase dashboard:\n');
  console.log('```sql');
  console.log('-- Drop and recreate the preco column as GENERATED');
  console.log('ALTER TABLE products DROP COLUMN IF EXISTS preco;');
  console.log('ALTER TABLE products ADD COLUMN preco NUMERIC(10,2) GENERATED ALWAYS AS (custo * (1 + COALESCE(margem_pct, 10) / 100)) STORED;');
  console.log('```\n');
  
  console.log('OR create a migration file with this content.');
}

fixPrecoColumn();
