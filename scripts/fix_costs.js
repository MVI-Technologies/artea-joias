import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

// Product costs mapping
const productPrices = {
  'Brinco, Argola Dupla Ródio Cravejada Ametista - 4,4cm': 21.95,
  'Brinco, Argola Dupla Ródio Cravejada Cristal - 4,4cm': 21.95,
  'Brinco, Argola Dupla Ródio Negro Cristal Negro - 4,4cm': 24.84,
  'Brinco, Argola Dupla Ródio Negro Multicor - 4,4cm': 24.84,
  'Brinco, Oval Ródio Negro Madrepérola Resinada com Citrino': 25.87,
  'Brinco, Oval Ródio Negro Madrepérola Resinada Multicor': 25.87,
  'Brinco, Brinco Mandala Ródio Branco Cravejado Micro': 33.12,
  'Brinco, Brinco Mandala Ródio Negro Cravejado Micro': 33.12,
  'Brinco, Ear Jacket Dourado': 18.20,
  'Brinco, Ear Jacket Ródio Branco': 18.20,
  'Brinco, Brinco Festa Dourado e Morganita': 65.45,
  'Anel, Anel Festa Dourado e Morganita': 16.94,
  'Brinco, Brinco Ear Cuff Ródio Negro Multicor': 16.98,
  'Brinco, Brinco Oval Pedra Grande R. Negro e Morganita': 30.36,
  'Brinco, Brinco Oval Pedra Grande R. Negro e Ágata Branca': 30.36,
  'Brinco, Brinco delicado R. Negro e Citrino 1,5x1,5cm': 11.87,
  'Brinco, Brinco Asa Dourado Citrino 1,5x2,8cm': 12.30,
  'Brinco, Brinco Asa Dourado Negro 1,5x2,8cm': 12.30,
  'Brinco, Brinco Navete Dourado Opala 2x2cm': 13.97,
  'Brinco, Brinco Navete Ródio Branco  2x2cm': 13.97,
  'Piercing, Conjunto Piercing Torcido Ródio Branco': 13.45,
  'Conjunto, Conjunto Brinco e Colar Bolinhas e Pérolas Dourado': 56.40,
  'Brinco, Brinco Pêndulo Dourado Cristal Pequeno 3x2cm': 17.67,
  'Piercing, Piercing Dourado Cristal Folhas': 10.08,
  'Brinco, Brinco Losango R. Branco Esmeralda 4,5x2cm': 25.85,
  'Brinco, Brinco Losango R. Branco Cristal 4,5x2cm': 25.85,
  'Brinco, Brinco Losango R. Negro Água Marinha 4,5x2cm': 25.85,
  'Brinco, Brinco Losango R. Negro Cristal 4,5x2cm': 25.85,
  'Brinco, Brinco delicado olho grego Dourado': 15.60,
  'Conjunto, Trio Dourado Cristais Citrino': 89.63,
  'Conjunto, Trio R. Branco Cristais': 89.63,
  'Brinco, Brinco Losango Gota Resinada Esm. Dourada Leve': 14.21,
  'Brinco, Brinco Losango Gota Resinada Cristal Dourada Leve': 14.21,
  'Brinco, Brinco Flor Ródio Branco Turmalina': 27.52,
  'Brinco, Brinco Flor Dourado Cristal': 27.52,
  'Conjunto, Conjunto Dourado Turmalina Resinado Leve': 36.28,
  'Brinco, Brinco Ródio Branco Cristal Resinado Leve': 14.54,
  'Anel, Anel R. Branco Resinado Cristal': 21.67,
  'Brinco, Brinco Oval Dourado Cristal Cravejado': 33.96,
  'Brinco, Brinco Oval Dourado Turmalina Cravejado': 33.96,
  'Brinco, Brinco Dourado Pingente Pérola': 15.04,
  'Brinco, Brinco Clássico Zircônias Cravejadas 4x1,5cm': 17.21,
  'Anel, Anel Luxo Zircônias': 28.60,
  'Brinco, Brinco Luxo Zircônias': 63.70,
  'Brinco, Brinco Luxo Zircônias Turmalina, Rubi e Cristal': 63.70,
  'Anel, Anel Luxo Zircônias Turmalina, Cristal e Rubi': 28.60,
  'Brinco, Brinco Redondo Pedra com Zircônias': 29.62,
  'Conjunto, Conjunto Dourado Laço e Cravação': 42.96,
  'Brinco, Brinco Flocos Dourado Morganita 1,6x1,2cm': 24.40,
  'Brinco, Brinco Argola Leve Dourada Friso': 34.60,
  'Brinco, Brinco Maxi Dourado': 32.48,
  'Conjunto, CONJUNTO GOTA DOURADO 1x1cm': 46.20,
  'Conjunto, CONJUNTO PÉROLA RÓDIO NEGRO': 163.00,
  'Conjunto, CONJUNTO PÉROLA RÓDIO BRANCO': 163.00,
  'Bracelete, BRACELETE LLA': 59.42,
  'Colar, COLAR CHAVE CORAÇÃO CRAVEJADO': 14.50,
  'Colar, COLAR LISO ELOS RÓDIO BRANCO': 64.98,
  'Colar, COLAR GRAVATA BORBOLETA ESMALTADA': 24.00,
  'Colar, COLAR GRAVATA BORBOLETA CRAVEJADA': 32.18,
  'Bracelete, BRACELETE CONCHA DOURADA': 59.62,
  'Brinco, BRINCO MALHA TORCIDA RETRÔ RÓDIO BRANCO': 30.92,
  'Brinco, BRINCO GRANDE AMASSADO DOURADO': 39.80,
  'Anel, ANEL VAZADO CRAVEJADO': 67.10,
  'Brinco, BRINCO VAZADO CRAVEJADO': 110.48
};

async function fixCosts() {
  console.log('\n🔧 FIXING PRODUCT COSTS\n');
  
  let updated = 0;
  let failed = 0;
  
  for (const [productName, cost] of Object.entries(productPrices)) {
    try {
      const { data, error } = await supabase
        .from('products')
        .update({ custo: cost })
        .eq('nome', productName)
        .select();
      
      if (error) {
        console.log(`❌ Failed to update "${productName}": ${error.message}`);
        failed++;
      } else if (data && data.length > 0) {
        console.log(`✅ ${productName.substring(0, 50).padEnd(52)} = R$ ${cost}`);
        updated++;
      } else {
        console.log(`⚠️  Product not found: "${productName}"`);
      }
    } catch (err) {
      console.log(`❌ Error updating "${productName}": ${err.message}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Updated: ${updated}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('='.repeat(60));
}

fixCosts();
