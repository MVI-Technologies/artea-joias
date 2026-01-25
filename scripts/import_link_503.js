import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

// Lista completa de produtos para link 503
const productsData = [
{"id": 242,"nome": "Brinco BRINCO MADREPEROLA","descricao": "Brinco, BRINCO MADREPEROLA","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-242.jpg","custo": 11.5,"margem_pct": null,"link_id": 503},
{"id": 243,"nome": "Brinco TRIO DE","descricao": "Brinco, TRIO DE BRINCO ZIRCONIAS","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-243.jpg","custo": 21.37,"margem_pct": null,"link_id": 503},
{"id": 244,"nome": "Brinco TRIO DE","descricao": "Brinco, TRIO DE ARGOLA CRAVEJADA","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-244.jpg","custo": 31.63,"margem_pct": null,"link_id": 503},
{"id": 245,"nome": "Brinco BRINCO FLOR","descricao": "Brinco, BRINCO FLOR BANHO DE PRATA","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-245.jpg","custo": 10.35,"margem_pct": null,"link_id": 503},
{"id": 248,"nome": "Brinco BRINCO BANHO","descricao": "Brinco, BRINCO BANHO DE PRATA PÉROLA","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-248.jpg","custo": 15.63,"margem_pct": null,"link_id": 503},
{"id": 249,"nome": "Brinco Brinco Argola","descricao": "Brinco, Brinco Argola Flor","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-249.jpg","custo": 10.83,"margem_pct": null,"link_id": 503},
{"id": 250,"nome": "Brinco BRINCO BANHO","descricao": "Brinco, BRINCO BANHO DE PRATA ZIRCONIAS","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-250.jpg","custo": 18.27,"margem_pct": null,"link_id": 503},
{"id": 251,"nome": "Brinco BRINCO BANHO","descricao": "Brinco, BRINCO BANHO DE PRATA","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-251.jpg","custo": 10.17,"margem_pct": null,"link_id": 503},
{"id": 252,"nome": "Brinco Brinco Vintage","descricao": "Brinco, Brinco Vintage","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-252.jpg","custo": 8.1,"margem_pct": null,"link_id": 503},
{"id": 253,"nome": "Colar COLAR BANHO","descricao": "Colar, COLAR BANHO DE PRATA MANDALA MADREPEROLA","categoria_id": "Colar","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-253.jpg","custo": 16.76,"margem_pct": null,"link_id": 503},
{"id": 254,"nome": "Colar Maxi Colar","descricao": "Colar, Maxi Colar Coração Dourado","categoria_id": "Colar","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-254.jpg","custo": 26.27,"margem_pct": null,"link_id": 503},
{"id": 255,"nome": "Colar Maxi Colar","descricao": "Colar, Maxi Colar Coração Prata","categoria_id": "Colar","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-255.jpg","custo": 26.27,"margem_pct": null,"link_id": 503},
{"id": 256,"nome": "Colar Colar Cristo","descricao": "Colar, Colar Cristo Redentor","categoria_id": "Colar","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-256.jpg","custo": 11.96,"margem_pct": null,"link_id": 503},
{"id": 257,"nome": "Corrente Colar Correntaria","descricao": "Corrente, Colar Correntaria Texturizado","categoria_id": "Corrente","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-257.jpg","custo": 12.24,"margem_pct": null,"link_id": 503},
{"id": 258,"nome": "Colar COLAR TERÇO","descricao": "Colar, COLAR TERÇO BANHO PRATA PEROLA","categoria_id": "Colar","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-258.jpg","custo": 25.33,"margem_pct": null,"link_id": 503},
{"id": 259,"nome": "Brinco TRIO DE","descricao": "Brinco, TRIO DE BRINCOS BANHO PRATA ZIRCÔNIAS","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-259.jpg","custo": 15.91,"margem_pct": null,"link_id": 503},
{"id": 260,"nome": "Brinco TRIO DE","descricao": "Brinco, TRIO DE BRINCOS BANHO DE PRATA","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-260.jpg","custo": 18.08,"margem_pct": null,"link_id": 503},
{"id": 261,"nome": "Brinco TRIO DE","descricao": "Brinco, TRIO DE ARGOLAS BANHO DE PRATA CORAÇÃO","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-261.jpg","custo": 16.67,"margem_pct": null,"link_id": 503},
{"id": 262,"nome": "Brinco Brinco Coração","descricao": "Brinco, Brinco Coração Texturizado","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-262.jpg","custo": 7.34,"margem_pct": null,"link_id": 503},
{"id": 263,"nome": "Brinco Brinco Argola","descricao": "Brinco, Brinco Argola Microzircônias","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-263.jpg","custo": 11.21,"margem_pct": null,"link_id": 503},
{"id": 264,"nome": "Brinco BRINCO MICROZIRCONIAS","descricao": "Brinco, BRINCO MICROZIRCONIAS","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-264.jpg","custo": 18.83,"margem_pct": null,"link_id": 503},
{"id": 278,"nome": "Brinco BRINCO MICROZIRCONIAS","descricao": "Brinco, BRINCO MICROZIRCONIAS","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-278.jpg","custo": 8.58,"margem_pct": null,"link_id": 503},
{"id": 279,"nome": "Brinco BRINCO FLOR","descricao": "Brinco, BRINCO FLOR MICROZIRCONIAS DOURADO","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-279.jpg","custo": 15.42,"margem_pct": null,"link_id": 503},
{"id": 280,"nome": "Brinco BRINCO BANHO","descricao": "Brinco, BRINCO BANHO DE PRATA","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-280.jpg","custo": 11.26,"margem_pct": null,"link_id": 503},
{"id": 281,"nome": "Brinco BRINCO MICROZIRCONIAS","descricao": "Brinco, BRINCO MICROZIRCONIAS","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-281.jpg","custo": 17.52,"margem_pct": null,"link_id": 503},
{"id": 282,"nome": "Pulseira PULSEIRA BANHO","descricao": "Pulseira, PULSEIRA BANHO PRATA FECHO GAVETA","categoria_id": "Pulseira","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-282.jpg","custo": 20.0,"margem_pct": null,"link_id": 503},
{"id": 283,"nome": "Pulseira PULSEIRA RIVIERA","descricao": "Pulseira, PULSEIRA RIVIERA FECHO RELÓGIO DOURADA","categoria_id": "Pulseira","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-283.jpg","custo": 19.42,"margem_pct": null,"link_id": 503},
{"id": 284,"nome": "Pulseira PULSEIRA TREVO","descricao": "Pulseira, PULSEIRA TREVO DOURADA","categoria_id": "Pulseira","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-284.jpg","custo": 14.12,"margem_pct": null,"link_id": 503},
{"id": 285,"nome": "Pulseira PULSEIRA RIVIERA","descricao": "Pulseira, PULSEIRA RIVIERA DOURADA","categoria_id": "Pulseira","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-285.jpg","custo": 12.51,"margem_pct": null,"link_id": 503},
{"id": 286,"nome": "Bracelete BRACELETE PREGO","descricao": "Bracelete, BRACELETE PREGO DOURADO","categoria_id": "Bracelete","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-286.jpg","custo": 20.5,"margem_pct": null,"link_id": 503},
{"id": 287,"nome": "Pulseira PULSEIRA RIVIERA","descricao": "Pulseira, PULSEIRA RIVIERA DOURADA","categoria_id": "Pulseira","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-287.jpg","custo": 12.34,"margem_pct": null,"link_id": 503},
{"id": 288,"nome": "Brinco ARGOLAS RETANGULARES","descricao": "Brinco, ARGOLAS RETANGULARES","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-288.jpg","custo": 9.75,"margem_pct": null,"link_id": 503},
{"id": 289,"nome": "Brinco BRINCO MICROZIRCONIAS","descricao": "Brinco, BRINCO MICROZIRCONIAS","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-289.jpg","custo": 7.5,"margem_pct": null,"link_id": 503},
{"id": 291,"nome": "Brinco BRINCO INSPIRAÇÃO","descricao": "Brinco, BRINCO INSPIRAÇÃO DOURADO","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-291.jpg","custo": 9.0,"margem_pct": null,"link_id": 503},
{"id": 292,"nome": "Brinco TRIO DE","descricao": "Brinco, TRIO DE ARGOLA CRAVEJADA","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-292.jpg","custo": 26.92,"margem_pct": null,"link_id": 503},
{"id": 293,"nome": "Brinco BRINCO MADREPEROLA","descricao": "Brinco, BRINCO MADREPEROLA","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-293.jpg","custo": 10.02,"margem_pct": null,"link_id": 503},
{"id": 294,"nome": "Brinco BRINCO ORGANICO","descricao": "Brinco, BRINCO ORGANICO DOURADO","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-294.jpg","custo": 14.84,"margem_pct": null,"link_id": 503},
{"id": 295,"nome": "Brinco BRINCO BANHO","descricao": "Brinco, BRINCO BANHO DE PRATA","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-295.jpg","custo": 14.09,"margem_pct": null,"link_id": 503},
{"id": 296,"nome": "Brinco BRINCO FLOR","descricao": "Brinco, BRINCO FLOR MADREPEROLA","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-296.jpg","custo": 11.0,"margem_pct": null,"link_id": 503},
{"id": 297,"nome": "Brinco TRIO DE","descricao": "Brinco, TRIO DE BRINCOS FLOR DOURADO","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-297.jpg","custo": 17.92,"margem_pct": null,"link_id": 503},
{"id": 298,"nome": "Brinco BRINCO ZIRCONIA","descricao": "Brinco, BRINCO ZIRCONIA DOURADO","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-298.jpg","custo": 9.58,"margem_pct": null,"link_id": 503},
{"id": 299,"nome": "Brinco BRINCO BOBOLETA","descricao": "Brinco, BRINCO BOBOLETA ZIRCONIAS DOURADA","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-299.jpg","custo": 10.02,"margem_pct": null,"link_id": 503},
{"id": 300,"nome": "Brinco BRINCO BORBOLETA","descricao": "Brinco, BRINCO BORBOLETA DOURADO","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-300.jpg","custo": 10.0,"margem_pct": null,"link_id": 503},
{"id": 301,"nome": "Brinco BRINCO CRAVEJADO","descricao": "Brinco, BRINCO CRAVEJADO MADREPEROLA","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-301.jpg","custo": 21.17,"margem_pct": null,"link_id": 503},
{"id": 302,"nome": "Brinco BRINCO ZIRCONIA","descricao": "Brinco, BRINCO ZIRCONIA DOURADO","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-302.jpg","custo": 14.11,"margem_pct": null,"link_id": 503},
{"id": 303,"nome": "Conjunto CONJUNTO RIVIERA","descricao": "Conjunto, CONJUNTO RIVIERA ZIRCONIAS COLORIDAS","categoria_id": "Conjunto","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-303.jpg","custo": 88.5,"margem_pct": null,"link_id": 503},
{"id": 304,"nome": "Conjunto CONJUNTO RIVIERA","descricao": "Conjunto, CONJUNTO RIVIERA TREVO DOURADO","categoria_id": "Conjunto","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-304.jpg","custo": 29.0,"margem_pct": null,"link_id": 503},
{"id": 305,"nome": "Conjunto CONJUNTO MICROZIRCONIAS","descricao": "Conjunto, CONJUNTO MICROZIRCONIAS","categoria_id": "Conjunto","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-305.jpg","custo": 19.84,"margem_pct": null,"link_id": 503},
{"id": 306,"nome": "Conjunto CONJUNTO ZIRCONIAS","descricao": "Conjunto, CONJUNTO ZIRCONIAS","categoria_id": "Conjunto","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-306.jpg","custo": 38.17,"margem_pct": null,"link_id": 503},
{"id": 307,"nome": "Conjunto CONJUNTO PIZZA","descricao": "Conjunto, CONJUNTO PIZZA DOURADO","categoria_id": "Conjunto","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-307.jpg","custo": 30.92,"margem_pct": null,"link_id": 503},
{"id": 308,"nome": "Conjunto COLAR PEROLA","descricao": "Conjunto, COLAR PEROLA BARROCA DOURADA","categoria_id": "Conjunto","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-308.jpg","custo": 19.5,"margem_pct": null,"link_id": 503},
{"id": 309,"nome": "Conjunto Conjunto Fusion","descricao": "Conjunto, Conjunto Fusion Dourado","categoria_id": "Conjunto","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-309.jpg","custo": 49.91,"margem_pct": null,"link_id": 503},
{"id": 310,"nome": "Conjunto Conjunto Fusion","descricao": "Conjunto, Conjunto Fusion Prata","categoria_id": "Conjunto","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-310.jpg","custo": 49.91,"margem_pct": null,"link_id": 503},
{"id": 311,"nome": "Pulseira PULSEIRA RIVIERA","descricao": "Pulseira, PULSEIRA RIVIERA DOURADA 1","categoria_id": "Pulseira","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-311.jpg","custo": 12.67,"margem_pct": null,"link_id": 503},
{"id": 312,"nome": "Bracelete BRACELETE ORGANICO","descricao": "Bracelete, BRACELETE ORGANICO DOURADO","categoria_id": "Bracelete","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-312.jpg","custo": 21.17,"margem_pct": null,"link_id": 503},
{"id": 313,"nome": "Brinco TRIO DE","descricao": "Brinco, TRIO DE BRINCOS FLOR DOURADO","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-313.jpg","custo": 12.6,"margem_pct": null,"link_id": 503},
{"id": 314,"nome": "Brinco BRINCO CORAÇÃO","descricao": "Brinco, BRINCO CORAÇÃO ZIRCONIA PRATA","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-314.jpg","custo": 9.67,"margem_pct": null,"link_id": 503},
{"id": 315,"nome": "Brinco BRINCO PEROLA","descricao": "Brinco, BRINCO PEROLA DOURADO","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-315.jpg","custo": 8.76,"margem_pct": null,"link_id": 503},
{"id": 316,"nome": "Brinco Brinco Click","descricao": "Brinco, Brinco Click Microzircônias Dourado","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-316.jpg","custo": 7.92,"margem_pct": null,"link_id": 503},
{"id": 317,"nome": "Brinco BRINCO TORCIDO","descricao": "Brinco, BRINCO TORCIDO DOURADO","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-317.jpg","custo": 16.03,"margem_pct": null,"link_id": 503},
{"id": 318,"nome": "Brinco BRINCO ABAULADO","descricao": "Brinco, BRINCO ABAULADO DOURADO","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-318.jpg","custo": 17.33,"margem_pct": null,"link_id": 503},
{"id": 319,"nome": "Brinco TRIO DE","descricao": "Brinco, TRIO DE ARGOLAS DOURADAS","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-319.jpg","custo": 11.25,"margem_pct": null,"link_id": 503},
{"id": 320,"nome": "Brinco BRINCO SOFT","descricao": "Brinco, BRINCO SOFT DOURADO 4","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-320.jpg","custo": 21.5,"margem_pct": null,"link_id": 503},
{"id": 321,"nome": "Brinco BRINCO REDONDO","descricao": "Brinco, BRINCO REDONDO VINTAGE DOURADO","categoria_id": "Brinco","imagem1": "https://cdn03.semijoias.net/assets/arteajoias/arteajoias-321.jpg","custo": 21.5,"margem_pct": null,"link_id": 503}
];

async function importProducts() {
  console.log('\n📦 IMPORTANDO PRODUTOS PARA LINK 503\n');
  
  try {
    // 1. Verificar/criar lote
    console.log('🔍 Verificando lote 503...');
    const { data: lot } = await supabase
      .from('lots')
      .select('id, nome')
      .eq('link_compra', 'link-503')
      .maybeSingle();
    
    let lotId;
    if (!lot) {
      console.log('   Criando lote...');
      const { data: newLot, error: createError } = await supabase
        .from('lots')
        .insert({
          nome: 'link 503 - Coleção Premium',
          status: 'aberto',
          link_compra: 'link-503'
        })
        .select()
        .single();
      
      if (createError) throw createError;
      lotId = newLot.id;
      console.log(`   ✅ Lote criado: ${newLot.nome}`);
    } else {
      lotId = lot.id;
      console.log(`   ✅ Lote encontrado: ${lot.nome}`);
    }
    
    // 2. Buscar categorias
    const { data: categories } = await supabase.from('categories').select('id, nome');
    const categoryMap = {};
    categories.forEach(cat => { categoryMap[cat.nome] = cat.id; });
    
    // 3. Processar produtos
    let created = 0, deleted = 0, linked = 0, categoriesCreated = 0;
    
    console.log(`\n🔄 Processando ${productsData.length} produtos...\n`);
    
    for (const item of productsData) {
      try {
        const categoryName = item.categoria_id;
        let categoryId = categoryMap[categoryName];
        
        if (!categoryId) {
          const { data: newCategory } = await supabase
            .from('categories')
            .insert({ nome: categoryName })
            .select()
            .single();
          categoryId = newCategory.id;
          categoryMap[categoryName] = categoryId;
          categoriesCreated++;
        }
        
        const { data: duplicates } = await supabase
          .from('products')
          .select('id')
          .or(`nome.eq.${item.descricao},imagem1.eq.${item.imagem1}`);
        
        if (duplicates?.length > 0) {
          for (const dup of duplicates) {
            await supabase.from('products').delete().eq('id', dup.id);
            deleted++;
          }
        }
        
        const { data: newProduct } = await supabase
          .from('products')
          .insert({
            nome: item.descricao,
            descricao: item.descricao,
            categoria_id: categoryId,
            imagem1: item.imagem1,
            custo: item.custo,
            margem_pct: item.margem_pct || 10,
            ativo: true
          })
          .select()
          .single();
        
        created++;
        console.log(`   ✅ ${item.descricao.substring(0, 50)}... - R$ ${item.custo}`);
        
        await supabase.from('lot_products').insert({
          lot_id: lotId,
          product_id: newProduct.id
        });
        linked++;
        
      } catch (itemError) {
        console.error(`   ❌ Erro: ${itemError.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO');
    console.log('='.repeat(60));
    console.log(`🆕 Categorias criadas: ${categoriesCreated}`);
    console.log(`🗑️  Duplicados removidos: ${deleted}`);
    console.log(`✨ Produtos criados: ${created}`);
    console.log(`🔗 Vinculados ao lote: ${linked}`);
    console.log(`📦 Total processado: ${productsData.length}`);
    console.log('='.repeat(60) + '\n');
    
    console.log('✅ Importação concluída!');
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    process.exit(1);
  }
}

importProducts();
