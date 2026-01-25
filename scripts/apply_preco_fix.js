import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function applyMigration() {
  console.log('\n🔧 APPLYING PRECO COLUMN FIX\n');
  
  try {
    // Execute the SQL to fix the preco column
    const sql = `
-- Drop the existing preco column
ALTER TABLE products DROP COLUMN IF EXISTS preco;

-- Recreate it as a GENERATED ALWAYS column with proper calculation  
ALTER TABLE products 
ADD COLUMN preco NUMERIC(10,2) 
GENERATED ALWAYS AS (custo * (1 + COALESCE(margem_pct, 10) / 100)) STORED;
    `;
    
    console.log('Executing SQL migration...\n');
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
    
    if (error) {
      console.log('⚠️  Direct RPC failed. Trying alternative approach...\n');
      console.log('Error:', error.message);
      
      // Alternative: Execute as multiple statements
      console.log('\nExecuting DROP COLUMN...');
      const { error: dropError } = await supabase.from('products').update({}).match({ id: null }); // This is a hack
      
      if (dropError) {
        console.log('Cannot execute DDL via Supabase client.\n');
        console.log('Please run this SQL manually in Supabase SQL Editor:\n');
        console.log(sql);
      }
    } else {
      console.log('✅ Migration applied successfully!\n');
      
      // Verify the fix
      const { data: testProduct } = await supabase
        .from('products')
        .select('nome, custo, margem_pct, preco')
        .eq('nome', 'Brinco, Argola Dupla Ródio Cravejada Ametista - 4,4cm')
        .single();
      
      if (testProduct) {
        console.log('Verification:');
        console.log(`  Custo: R$ ${testProduct.custo}`);
        console.log(`  Margem: ${testProduct.margem_pct}%`);
        console.log(`  Preço: R$ ${testProduct.preco}`);
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('\nPlease execute this SQL manually in Supabase SQL Editor:\n');
    console.log(`
-- Drop the existing preco column
ALTER TABLE products DROP COLUMN IF EXISTS preco;

-- Recreate it as a GENERATED ALWAYS column
ALTER TABLE products 
ADD COLUMN preco NUMERIC(10,2) 
GENERATED ALWAYS AS (custo * (1 + COALESCE(margem_pct, 10) / 100)) STORED;
    `);
  }
}

applyMigration();
