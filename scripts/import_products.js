import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Extracted product data from HTML table
const productsData = [
  { id: 182, desc: 'Brinco, Argola Dupla Ródio Cravejada Ametista - 4,4cm', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-182.jpg', price: 21.95, categoria: 'Brinco' },
  { id: 189, desc: 'Brinco, Argola Dupla Ródio Cravejada Cristal - 4,4cm', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-189.jpg', price: 21.95, categoria: 'Brinco' },
  { id: 190, desc: 'Brinco, Argola Dupla Ródio Negro Cristal Negro - 4,4cm', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-190.jpg', price: 24.84, categoria: 'Brinco' },
  { id: 191, desc: 'Brinco, Argola Dupla Ródio Negro Multicor - 4,4cm', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-191.jpg', price: 24.84, categoria: 'Brinco' },
  { id: 192, desc: 'Brinco, Oval Ródio Negro Madrepérola Resinada com Citrino', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-192.jpg', price: 25.87, categoria: 'Brinco' },
  { id: 193, desc: 'Brinco, Oval Ródio Negro Madrepérola Resinada Multicor', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-193.jpg', price: 25.87, categoria: 'Brinco' },
  { id: 194, desc: 'Brinco, Oval Ródio Negro Madrepérola Resinada com Citrino', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-194.jpg', price: 25.87, categoria: 'Brinco' },
  { id: 195, desc: 'Brinco, Brinco Mandala Ródio Branco Cravejado Micro', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-195.jpg', price: 33.12, categoria: 'Brinco' },
  { id: 196, desc: 'Brinco, Brinco Mandala Ródio Negro Cravejado Micro', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-196.jpg', price: 33.12, categoria: 'Brinco' },
  { id: 197, desc: 'Brinco, Ear Jacket Dourado', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-197.jpg', price: 18.20, categoria: 'Brinco' },
  { id: 198, desc: 'Brinco, Ear Jacket Ródio Branco', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-198.jpg', price: 18.20, categoria: 'Brinco' },
  { id: 199, desc: 'Brinco, Brinco Festa Dourado e Morganita', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-199.jpg', price: 65.45, categoria: 'Brinco' },
  { id: 200, desc: 'Anel, Anel Festa Dourado e Morganita', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-200.jpg', price: 16.94, categoria: 'Anel' },
  { id: 202, desc: 'Brinco, Brinco Ear Cuff Ródio Negro Multicor', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-202.jpg', price: 16.98, categoria: 'Brinco' },
  { id: 203, desc: 'Brinco, Brinco Oval Pedra Grande R. Negro e Morganita', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-203.jpg', price: 30.36, categoria: 'Brinco' },
  { id: 204, desc: 'Brinco, Brinco Oval Pedra Grande R. Negro e Ágata Branca', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-204.jpg', price: 30.36, categoria: 'Brinco' },
  { id: 205, desc: 'Brinco, Brinco delicado R. Negro e Citrino 1,5x1,5cm', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-205.jpg', price: 11.87, categoria: 'Brinco' },
  { id: 206, desc: 'Brinco, Brinco Asa Dourado Citrino 1,5x2,8cm', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-206.jpg', price: 12.30, categoria: 'Brinco' },
  { id: 207, desc: 'Brinco, Brinco Asa Dourado Negro 1,5x2,8cm', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-207.jpg', price: 12.30, categoria: 'Brinco' },
  { id: 208, desc: 'Brinco, Brinco Navete Dourado Opala 2x2cm', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-208.jpg', price: 13.97, categoria: 'Brinco' },
  { id: 209, desc: 'Brinco, Brinco Navete Ródio Branco  2x2cm', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-209.jpg', price: 13.97, categoria: 'Brinco' },
  { id: 211, desc: 'Piercing, Conjunto Piercing Torcido Ródio Branco', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-211.jpg', price: 13.45, categoria: 'Piercing' },
  { id: 212, desc: 'Conjunto, Conjunto Brinco e Colar Bolinhas e Pérolas Dourado', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-212.jpg', price: 56.40, categoria: 'Conjunto' },
  { id: 213, desc: 'Brinco, Brinco Pêndulo Dourado Cristal Pequeno 3x2cm', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-213.jpg', price: 17.67, categoria: 'Brinco' },
  { id: 214, desc: 'Piercing, Piercing Dourado Cristal Folhas', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-214.jpg', price: 10.08, categoria: 'Piercing' },
  { id: 215, desc: 'Brinco, Brinco Losango R. Branco Esmeralda 4,5x2cm', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-215.jpg', price: 25.85, categoria: 'Brinco' },
  { id: 216, desc: 'Brinco, Brinco Losango R. Branco Cristal 4,5x2cm', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-216.jpg', price: 25.85, categoria: 'Brinco' },
  { id: 217, desc: 'Brinco, Brinco Losango R. Negro Água Marinha 4,5x2cm', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-217.jpg', price: 25.85, categoria: 'Brinco' },
  { id: 218, desc: 'Brinco, Brinco Losango R. Negro Cristal 4,5x2cm', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-218.jpg', price: 25.85, categoria: 'Brinco' },
  { id: 219, desc: 'Brinco, Brinco delicado olho grego Dourado', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-219.jpg', price: 15.60, categoria: 'Brinco' },
  { id: 220, desc: 'Conjunto, Trio Dourado Cristais Citrino', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-220.jpg', price: 89.63, categoria: 'Conjunto' },
  { id: 221, desc: 'Conjunto, Trio R. Branco Cristais', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-221.jpg', price: 89.63, categoria: 'Conjunto' },
  { id: 222, desc: 'Brinco, Brinco Losango Gota Resinada Esm. Dourada Leve', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-222.jpg', price: 14.21, categoria: 'Brinco' },
  { id: 223, desc: 'Brinco, Brinco Losango Gota Resinada Cristal Dourada Leve', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-223.jpg', price: 14.21, categoria: 'Brinco' },
  { id: 224, desc: 'Brinco, Brinco Flor Ródio Branco Turmalina', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-224.jpg', price: 27.52, categoria: 'Brinco' },
  { id: 225, desc: 'Brinco, Brinco Flor Dourado Cristal', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-225.jpg', price: 27.52, categoria: 'Brinco' },
  { id: 226, desc: 'Conjunto, Conjunto Dourado Turmalina Resinado Leve', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-226.jpg', price: 36.28, categoria: 'Conjunto' },
  { id: 227, desc: 'Brinco, Brinco Ródio Branco Cristal Resinado Leve', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-227.jpg', price: 14.54, categoria: 'Brinco' },
  { id: 228, desc: 'Anel, Anel R. Branco Resinado Cristal', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-228.jpg', price: 21.67, categoria: 'Anel' },
  { id: 229, desc: 'Brinco, Brinco Oval Dourado Cristal Cravejado', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-229.jpg', price: 33.96, categoria: 'Brinco' },
  { id: 230, desc: 'Brinco, Brinco Oval Dourado Turmalina Cravejado', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-230.jpg', price: 33.96, categoria: 'Brinco' },
  { id: 231, desc: 'Brinco, Brinco Dourado Pingente Pérola', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-231.jpg', price: 15.04, categoria: 'Brinco' },
  { id: 232, desc: 'Brinco, Brinco Clássico Zircônias Cravejadas 4x1,5cm', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-232.jpg', price: 17.21, categoria: 'Brinco' },
  { id: 233, desc: 'Anel, Anel Luxo Zircônias', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-233.jpg', price: 28.60, categoria: 'Anel' },
  { id: 234, desc: 'Brinco, Brinco Luxo Zircônias', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-234.jpg', price: 63.70, categoria: 'Brinco' },
  { id: 235, desc: 'Brinco, Brinco Luxo Zircônias Turmalina, Rubi e Cristal', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-235.jpg', price: 63.70, categoria: 'Brinco' },
  { id: 236, desc: 'Anel, Anel Luxo Zircônias Turmalina, Cristal e Rubi', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-236.jpg', price: 28.60, categoria: 'Anel' },
  { id: 237, desc: 'Brinco, Brinco Redondo Pedra com Zircônias', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-237.jpg', price: 29.62, categoria: 'Brinco' },
  { id: 238, desc: 'Conjunto, Conjunto Dourado Laço e Cravação', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-238.jpg', price: 42.96, categoria: 'Conjunto' },
  { id: 239, desc: 'Brinco, Brinco Flocos Dourado Morganita 1,6x1,2cm', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-239.jpg', price: 24.40, categoria: 'Brinco' },
  { id: 240, desc: 'Brinco, Brinco Argola Leve Dourada Friso', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-240.jpg', price: 34.60, categoria: 'Brinco' },
  { id: 241, desc: 'Brinco, Brinco Maxi Dourado', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-241.jpg', price: 32.48, categoria: 'Brinco' },
  { id: 265, desc: 'Conjunto, CONJUNTO GOTA DOURADO 1x1cm', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-265.jpeg', price: 46.20, categoria: 'Conjunto' },
  { id: 266, desc: 'Conjunto, CONJUNTO PÉROLA RÓDIO NEGRO', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-266.jpeg', price: 163.00, categoria: 'Conjunto' },
  { id: 267, desc: 'Conjunto, CONJUNTO PÉROLA RÓDIO BRANCO', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-267.jpeg', price: 163.00, categoria: 'Conjunto' },
  { id: 268, desc: 'Bracelete, BRACELETE LLA', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-268.jpeg', price: 59.42, categoria: 'Pulseira' },
  { id: 269, desc: 'Colar, COLAR CHAVE CORAÇÃO CRAVEJADO', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-269.jpeg', price: 14.50, categoria: 'Colar' },
  { id: 270, desc: 'Colar, COLAR LISO ELOS RÓDIO BRANCO', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-270.jpeg', price: 64.98, categoria: 'Colar' },
  { id: 271, desc: 'Colar, COLAR GRAVATA BORBOLETA ESMALTADA', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-271.jpeg', price: 24.00, categoria: 'Colar' },
  { id: 272, desc: 'Colar, COLAR GRAVATA BORBOLETA CRAVEJADA', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-272.jpeg', price: 32.18, categoria: 'Colar' },
  { id: 273, desc: 'Bracelete, BRACELETE CONCHA DOURADA', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-273.jpeg', price: 59.62, categoria: 'Pulseira' },
  { id: 274, desc: 'Brinco, BRINCO MALHA TORCIDA RETRÔ RÓDIO BRANCO', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-274.jpeg', price: 30.92, categoria: 'Brinco' },
  { id: 275, desc: 'Brinco, BRINCO GRANDE AMASSADO DOURADO', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-275.png', price: 39.80, categoria: 'Brinco' },
  { id: 276, desc: 'Anel, ANEL VAZADO CRAVEJADO', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-276.jpeg', price: 67.10, categoria: 'Anel' },
  { id: 277, desc: 'Brinco, BRINCO VAZADO CRAVEJADO', img: 'https://cdn03.semijoias.net/assets/arteajoias/arteajoias-277.jpeg', price: 110.48, categoria: 'Brinco' }
];

async function importProducts() {
  try {
    console.log('🔍 Finding lot "link 502 - Semijoias de Luxo no Precinho"...');
    
    // Find the lot
    const { data: lots, error: lotError } = await supabase
      .from('lots')
      .select('id, nome')
      .ilike('nome', '%link 502%');
    
    if (lotError) throw lotError;
    
    if (!lots || lots.length === 0) {
      console.error('❌ Lot not found. Creating it...');
      
      const { data: newLot, error: createError } = await supabase
        .from('lots')
        .insert({
          nome: 'link 502 - Semijoias de Luxo no Precinho',
          status: 'aberto',
          link_compra: `link-502-${Date.now()}`
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      console.log('✅ Lot created:', newLot.nome);
      return await processProducts(newLot.id);
    }
    
    const lot = lots[0];
    console.log(`✅ Found lot: ${lot.nome} (ID: ${lot.id})`);
    
    return await processProducts(lot.id);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function processProducts(lotId) {
  try {
    console.log('\n📦 Getting categories...');
    
    // Get all categories
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('id, nome');
    
    if (catError) throw catError;
    
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.nome] = cat.id;
    });
    
    console.log(`✅ Found ${categories.length} categories`);
    
    let created = 0;
    let updated = 0;
    let linked = 0;
    
    console.log(`\n📝 Processing ${productsData.length} products...\n`);
    
    for (const item of productsData) {
      try {
        // Check if product already exists
        const { data: existing } = await supabase
          .from('products')
          .select('id')
          .eq('nome', item.desc)
          .single();
        
        let productId;
        
        if (existing) {
          // Update existing product
          const { data: updatedProduct, error: updateError } = await supabase
            .from('products')
            .update({
              custo: item.price,
              imagem1: item.img,
              categoria_id: categoryMap[item.categoria] || categoryMap['Outros']
            })
            .eq('id', existing.id)
            .select()
            .single();
          
          if (updateError) throw updateError;
          
          productId = existing.id;
          updated++;
          console.log(`🔄 Updated: ${item.desc.substring(0, 50)}...`);
        } else {
          // Create new product
          const { data: newProduct, error: createError } = await supabase
            .from('products')
            .insert({
              nome: item.desc,
              custo: item.price,
              imagem1: item.img,
              categoria_id: categoryMap[item.categoria] || categoryMap['Outros'],
              ativo: true
            })
            .select()
            .single();
          
          if (createError) throw createError;
          
          productId = newProduct.id;
          created++;
          console.log(`✨ Created: ${item.desc.substring(0, 50)}...`);
        }
        
        // Link product to lot
        const { error: linkError } = await supabase
          .from('lot_products')
          .upsert({
            lot_id: lotId,
            product_id: productId
          }, {
            onConflict: 'lot_id,product_id'
          });
        
        if (linkError) {
          console.warn(`⚠️  Failed to link product ${item.desc}: ${linkError.message}`);
        } else {
          linked++;
        }
        
      } catch (itemError) {
        console.error(`❌ Error processing ${item.desc}:`, itemError.message);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 IMPORT SUMMARY:');
    console.log('='.repeat(50));
    console.log(`✨ Products created: ${created}`);
    console.log(`🔄 Products updated: ${updated}`);
    console.log(`🔗 Products linked to lot: ${linked}`);
    console.log(`📦 Total products: ${productsData.length}`);
    console.log('='.repeat(50) + '\n');
    
    console.log('✅ Import completed successfully!');
    
  } catch (error) {
    console.error('❌ Error processing products:', error.message);
    process.exit(1);
  }
}

// Run the import
importProducts();
