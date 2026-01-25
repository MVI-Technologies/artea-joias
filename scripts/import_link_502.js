import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

// Função para extrair URL de markdown [url](url)
function extractUrl(imageStr) {
  if (!imageStr) return null;
  const match = imageStr.match(/\[([^\]]+)\]\(([^)]+)\)/);
  return match ? match[1] : imageStr;
}

// Lista de produtos a importar
const productsDataRaw = [
{"id": 182,"nome": "Brinco, Argola Dupla","descricao": "Brinco, Argola Dupla Ródio Cravejada Ametista - 4,4cm","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-182.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-182.jpg)","custo": 21.95,"margem_pct": null,"link_id": 502},
{"id": 189,"nome": "Brinco, Argola Dupla","descricao": "Brinco, Argola Dupla Ródio Cravejada Cristal - 4,4cm","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-189.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-189.jpg)","custo": 21.95,"margem_pct": null,"link_id": 502},
{"id": 190,"nome": "Brinco, Argola Dupla","descricao": "Brinco, Argola Dupla Ródio Negro Cristal Negro - 4,4cm","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-190.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-190.jpg)","custo": 24.84,"margem_pct": null,"link_id": 502},
{"id": 191,"nome": "Brinco, Argola Dupla","descricao": "Brinco, Argola Dupla Ródio Negro Multicor - 4,4cm","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-191.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-191.jpg)","custo": 24.84,"margem_pct": null,"link_id": 502},
{"id": 192,"nome": "Brinco, Oval Ródio","descricao": "Brinco, Oval Ródio Negro Madrepérola Resinada com Citrino","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-192.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-192.jpg)","custo": 25.87,"margem_pct": null,"link_id": 502},
{"id": 193,"nome": "Brinco, Oval Ródio","descricao": "Brinco, Oval Ródio Negro Madrepérola Resinada Multicor","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-193.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-193.jpg)","custo": 25.87,"margem_pct": null,"link_id": 502},
{"id": 194,"nome": "Brinco, Oval Ródio","descricao": "Brinco, Oval Ródio Negro Madrepérola Resinada com Citrino","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-194.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-194.jpg)","custo": 25.87,"margem_pct": null,"link_id": 502},
{"id": 195,"nome": "Brinco, Brinco Mandala","descricao": "Brinco, Brinco Mandala Ródio Branco Cravejado Micro","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-195.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-195.jpg)","custo": 33.12,"margem_pct": null,"link_id": 502},
{"id": 196,"nome": "Brinco, Brinco Mandala","descricao": "Brinco, Brinco Mandala Ródio Negro Cravejado Micro","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-196.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-196.jpg)","custo": 33.12,"margem_pct": null,"link_id": 502},
{"id": 197,"nome": "Brinco, Ear Jacket","descricao": "Brinco, Ear Jacket Dourado","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-197.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-197.jpg)","custo": 18.2,"margem_pct": null,"link_id": 502},
{"id": 198,"nome": "Brinco, Ear Jacket","descricao": "Brinco, Ear Jacket Ródio Branco","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-198.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-198.jpg)","custo": 18.2,"margem_pct": null,"link_id": 502},
{"id": 199,"nome": "Brinco, Brinco Festa","descricao": "Brinco, Brinco Festa Dourado e Morganita","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-199.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-199.jpg)","custo": 65.45,"margem_pct": null,"link_id": 502},
{"id": 200,"nome": "Anel, Anel Festa","descricao": "Anel, Anel Festa Dourado e Morganita","categoria_id": "Anel","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-200.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-200.jpg)","custo": 16.94,"margem_pct": null,"link_id": 502},
{"id": 202,"nome": "Brinco, Brinco Ear","descricao": "Brinco, Brinco Ear Cuff Ródio Negro Multicor","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-202.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-202.jpg)","custo": 16.98,"margem_pct": null,"link_id": 502},
{"id": 203,"nome": "Brinco, Brinco Oval","descricao": "Brinco, Brinco Oval Pedra Grande R. Negro e Morganita","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-203.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-203.jpg)","custo": 30.36,"margem_pct": null,"link_id": 502},
{"id": 204,"nome": "Brinco, Brinco Oval","descricao": "Brinco, Brinco Oval Pedra Grande R. Negro e Ágata Branca","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-204.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-204.jpg)","custo": 30.36,"margem_pct": null,"link_id": 502},
{"id": 205,"nome": "Brinco, Brinco delicado","descricao": "Brinco, Brinco delicado R. Negro e Citrino 1,5x1,5cm","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-205.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-205.jpg)","custo": 11.87,"margem_pct": null,"link_id": 502},
{"id": 206,"nome": "Brinco, Brinco Asa","descricao": "Brinco, Brinco Asa Dourado Citrino 1,5x2,8cm","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-206.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-206.jpg)","custo": 12.3,"margem_pct": null,"link_id": 502},
{"id": 207,"nome": "Brinco, Brinco Asa","descricao": "Brinco, Brinco Asa Dourado Negro 1,5x2,8cm","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-207.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-207.jpg)","custo": 12.3,"margem_pct": null,"link_id": 502},
{"id": 208,"nome": "Brinco, Brinco Navete","descricao": "Brinco, Brinco Navete Dourado Opala 2x2cm","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-208.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-208.jpg)","custo": 13.97,"margem_pct": null,"link_id": 502},
{"id": 209,"nome": "Brinco, Brinco Navete","descricao": "Brinco, Brinco Navete Ródio Branco  2x2cm","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-209.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-209.jpg)","custo": 13.97,"margem_pct": null,"link_id": 502},
{"id": 211,"nome": "Piercing, Conjunto Piercing","descricao": "Piercing, Conjunto Piercing Torcido Ródio Branco","categoria_id": "Piercing","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-211.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-211.jpg)","custo": 13.45,"margem_pct": null,"link_id": 502},
{"id": 212,"nome": "Conjunto, Conjunto Brinco","descricao": "Conjunto, Conjunto Brinco e Colar Bolinhas e Pérolas Dourado","categoria_id": "Conjunto","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-212.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-212.jpg)","custo": 56.4,"margem_pct": null,"link_id": 502},
{"id": 213,"nome": "Brinco, Brinco Pêndulo","descricao": "Brinco, Brinco Pêndulo Dourado Cristal Pequeno 3x2cm","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-213.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-213.jpg)","custo": 17.67,"margem_pct": null,"link_id": 502},
{"id": 214,"nome": "Piercing, Piercing Dourado","descricao": "Piercing, Piercing Dourado Cristal Folhas","categoria_id": "Piercing","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-214.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-214.jpg)","custo": 10.08,"margem_pct": null,"link_id": 502},
{"id": 215,"nome": "Brinco, Brinco Losango","descricao": "Brinco, Brinco Losango R. Branco Esmeralda 4,5x2cm","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-215.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-215.jpg)","custo": 25.85,"margem_pct": null,"link_id": 502},
{"id": 216,"nome": "Brinco, Brinco Losango","descricao": "Brinco, Brinco Losango R. Branco Cristal 4,5x2cm","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-216.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-216.jpg)","custo": 25.85,"margem_pct": null,"link_id": 502},
{"id": 217,"nome": "Brinco, Brinco Losango","descricao": "Brinco, Brinco Losango R. Negro Água Marinha 4,5x2cm","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-217.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-217.jpg)","custo": 25.85,"margem_pct": null,"link_id": 502},
{"id": 218,"nome": "Brinco, Brinco Losango","descricao": "Brinco, Brinco Losango R. Negro Cristal 4,5x2cm","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-218.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-218.jpg)","custo": 25.85,"margem_pct": null,"link_id": 502},
{"id": 219,"nome": "Brinco, Brinco delicado","descricao": "Brinco, Brinco delicado olho grego Dourado","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-219.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-219.jpg)","custo": 15.6,"margem_pct": null,"link_id": 502},
{"id": 220,"nome": "Conjunto, Trio Dourado","descricao": "Conjunto, Trio Dourado Cristais Citrino","categoria_id": "Conjunto","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-220.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-220.jpg)","custo": 89.63,"margem_pct": null,"link_id": 502},
{"id": 221,"nome": "Conjunto, Trio R.","descricao": "Conjunto, Trio R. Branco Cristais","categoria_id": "Conjunto","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-221.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-221.jpg)","custo": 89.63,"margem_pct": null,"link_id": 502},
{"id": 222,"nome": "Brinco, Brinco Losango","descricao": "Brinco, Brinco Losango Gota Resinada Esm. Dourada Leve","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-222.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-222.jpg)","custo": 14.21,"margem_pct": null,"link_id": 502},
{"id": 223,"nome": "Brinco, Brinco Losango","descricao": "Brinco, Brinco Losango Gota Resinada Cristal Dourada Leve","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-223.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-223.jpg)","custo": 14.21,"margem_pct": null,"link_id": 502},
{"id": 224,"nome": "Brinco, Brinco Flor","descricao": "Brinco, Brinco Flor Ródio Branco Turmalina","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-224.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-224.jpg)","custo": 27.52,"margem_pct": null,"link_id": 502},
{"id": 225,"nome": "Brinco, Brinco Flor","descricao": "Brinco, Brinco Flor Dourado Cristal","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-225.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-225.jpg)","custo": 27.52,"margem_pct": null,"link_id": 502},
{"id": 226,"nome": "Conjunto, Conjunto Dourado","descricao": "Conjunto, Conjunto Dourado Turmalina Resinado Leve","categoria_id": "Conjunto","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-226.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-226.jpg)","custo": 36.28,"margem_pct": null,"link_id": 502},
{"id": 227,"nome": "Brinco, Brinco Ródio","descricao": "Brinco, Brinco Ródio Branco Cristal Resinado Leve","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-227.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-227.jpg)","custo": 14.54,"margem_pct": null,"link_id": 502},
{"id": 228,"nome": "Anel, Anel R.","descricao": "Anel, Anel R. Branco Resinado Cristal","categoria_id": "Anel","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-228.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-228.jpg)","custo": 21.67,"margem_pct": null,"link_id": 502},
{"id": 229,"nome": "Brinco, Brinco Oval","descricao": "Brinco, Brinco Oval Dourado Cristal Cravejado","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-229.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-229.jpg)","custo": 33.96,"margem_pct": null,"link_id": 502},
{"id": 230,"nome": "Brinco, Brinco Oval","descricao": "Brinco, Brinco Oval Dourado Turmalina Cravejado","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-230.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-230.jpg)","custo": 33.96,"margem_pct": null,"link_id": 502},
{"id": 231,"nome": "Brinco, Brinco Dourado","descricao": "Brinco, Brinco Dourado Pingente Pérola","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-231.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-231.jpg)","custo": 15.04,"margem_pct": null,"link_id": 502},
{"id": 232,"nome": "Brinco, Brinco Clássico","descricao": "Brinco, Brinco Clássico Zircônias Cravejadas 4x1,5cm","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-232.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-232.jpg)","custo": 17.21,"margem_pct": null,"link_id": 502},
{"id": 233,"nome": "Anel, Anel Luxo","descricao": "Anel, Anel Luxo Zircônias","categoria_id": "Anel","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-233.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-233.jpg)","custo": 28.6,"margem_pct": null,"link_id": 502},
{"id": 234,"nome": "Brinco, Brinco Luxo","descricao": "Brinco, Brinco Luxo Zircônias","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-234.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-234.jpg)","custo": 63.7,"margem_pct": null,"link_id": 502},
{"id": 235,"nome": "Brinco, Brinco Luxo","descricao": "Brinco, Brinco Luxo Zircônias Turmalina, Rubi e Cristal","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-235.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-235.jpg)","custo": 63.7,"margem_pct": null,"link_id": 502},
{"id": 236,"nome": "Anel, Anel Luxo","descricao": "Anel, Anel Luxo Zircônias Turmalina, Cristal e Rubi","categoria_id": "Anel","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-236.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-236.jpg)","custo": 28.6,"margem_pct": null,"link_id": 502},
{"id": 237,"nome": "Brinco, Brinco Redondo","descricao": "Brinco, Brinco Redondo Pedra com Zircônias","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-237.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-237.jpg)","custo": 29.62,"margem_pct": null,"link_id": 502},
{"id": 238,"nome": "Conjunto, Conjunto Dourado","descricao": "Conjunto, Conjunto Dourado Laço e Cravação","categoria_id": "Conjunto","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-238.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-238.jpg)","custo": 42.96,"margem_pct": null,"link_id": 502},
{"id": 239,"nome": "Brinco, Brinco Flocos","descricao": "Brinco, Brinco Flocos Dourado Morganita 1,6x1,2cm","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-239.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-239.jpg)","custo": 24.4,"margem_pct": null,"link_id": 502},
{"id": 240,"nome": "Brinco, Brinco Argola","descricao": "Brinco, Brinco Argola Leve Dourada Friso","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-240.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-240.jpg)","custo": 34.6,"margem_pct": null,"link_id": 502},
{"id": 241,"nome": "Brinco, Brinco Maxi","descricao": "Brinco, Brinco Maxi Dourado","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-241.jpg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-241.jpg)","custo": 32.48,"margem_pct": null,"link_id": 502},
{"id": 265,"nome": "Conjunto, CONJUNTO GOTA","descricao": "Conjunto, CONJUNTO GOTA DOURADO 1x1cm","categoria_id": "Conjunto","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-265.jpeg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-265.jpeg)","custo": 46.2,"margem_pct": null,"link_id": 502},
{"id": 266,"nome": "Conjunto, CONJUNTO PÉROLA","descricao": "Conjunto, CONJUNTO PÉROLA RÓDIO NEGRO","categoria_id": "Conjunto","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-266.jpeg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-266.jpeg)","custo": 163.0,"margem_pct": null,"link_id": 502},
{"id": 267,"nome": "Conjunto, CONJUNTO PÉROLA","descricao": "Conjunto, CONJUNTO PÉROLA RÓDIO BRANCO","categoria_id": "Conjunto","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-267.jpeg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-267.jpeg)","custo": 163.0,"margem_pct": null,"link_id": 502},
{"id": 268,"nome": "Bracelete, BRACELETE LLA","descricao": "Bracelete, BRACELETE LLA","categoria_id": "Bracelete","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-268.jpeg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-268.jpeg)","custo": 59.42,"margem_pct": null,"link_id": 502},
{"id": 269,"nome": "Colar, COLAR CHAVE","descricao": "Colar, COLAR CHAVE CORAÇÃO CRAVEJADO","categoria_id": "Colar","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-269.jpeg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-269.jpeg)","custo": 14.5,"margem_pct": null,"link_id": 502},
{"id": 270,"nome": "Colar, COLAR LISO","descricao": "Colar, COLAR LISO ELOS RÓDIO BRANCO","categoria_id": "Colar","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-270.jpeg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-270.jpeg)","custo": 64.98,"margem_pct": null,"link_id": 502},
{"id": 271,"nome": "Colar, COLAR GRAVATA","descricao": "Colar, COLAR GRAVATA BORBOLETA ESMALTADA","categoria_id": "Colar","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-271.jpeg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-271.jpeg)","custo": 24.0,"margem_pct": null,"link_id": 502},
{"id": 272,"nome": "Colar, COLAR GRAVATA","descricao": "Colar, COLAR GRAVATA BORBOLETA CRAVEJADA","categoria_id": "Colar","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-272.jpeg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-272.jpeg)","custo": 32.18,"margem_pct": null,"link_id": 502},
{"id": 273,"nome": "Bracelete, BRACELETE CONCHA","descricao": "Bracelete, BRACELETE CONCHA DOURADA","categoria_id": "Bracelete","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-273.jpeg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-273.jpeg)","custo": 59.62,"margem_pct": null,"link_id": 502},
{"id": 274,"nome": "Brinco, BRINCO MALHA","descricao": "Brinco, BRINCO MALHA TORCIDA RETRÔ RÓDIO BRANCO","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-274.jpeg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-274.jpeg)","custo": 30.92,"margem_pct": null,"link_id": 502},
{"id": 275,"nome": "Brinco, BRINCO GRANDE","descricao": "Brinco, BRINCO GRANDE AMASSADO DOURADO","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-275.png](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-275.png)","custo": 39.8,"margem_pct": null,"link_id": 502},
{"id": 276,"nome": "Anel, ANEL VAZADO","descricao": "Anel, ANEL VAZADO CRAVEJADO","categoria_id": "Anel","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-276.jpeg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-276.jpeg)","custo": 67.1,"margem_pct": null,"link_id": 502},
{"id": 277,"nome": "Brinco, BRINCO VAZADO","descricao": "Brinco, BRINCO VAZADO CRAVEJADO","categoria_id": "Brinco","imagem1": "[https://cdn03.semijoias.net/assets/arteajoias/arteajoias-277.jpeg](https://cdn03.semijoias.net/assets/arteajoias/arteajoias-277.jpeg)","custo": 110.48,"margem_pct": null,"link_id": 502}
];

// Processar URLs das imagens
const productsData = productsDataRaw.map(p => ({
  ...p,
  imagem1: extractUrl(p.imagem1)
}));

async function importProducts() {
  console.log('\n📦 IMPORTANDO PRODUTOS PARA LINK 502\n');
  
  try {
    // 1. Verificar/criar lote
    console.log('🔍 Verificando lote 502...');
    const { data: lot, error: lotError } = await supabase
      .from('lots')
      .select('id, nome')
      .eq('link_compra', 'link-502')
      .maybeSingle();
    
    let lotId;
    if (!lot) {
      console.log('   Lote não encontrado, criando...');
      const { data: newLot, error: createError } = await supabase
        .from('lots')
        .insert({
          nome: 'link 502 - Semijoias de Luxo no Precinho',
          status: 'aberto',
          link_compra: 'link-502'
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
    
    // 2. Buscar todas as categorias
    console.log('\n📋 Buscando categorias...');
    const { data: categories } = await supabase
      .from('categories')
      .select('id, nome');
    
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.nome] = cat.id;
    });
    console.log(`   ✅ ${categories.length} categorias encontradas`);
    
    // 3. Processar produtos
    let created = 0;
    let deleted = 0;
    let linked = 0;
    let categoriesCreated = 0;
    
    console.log(`\n🔄 Processando ${productsData.length} produtos...\n`);
    
    for (const item of productsData) {
      try {
        const categoryName = item.categoria_id;
        let categoryId = categoryMap[categoryName];
        
        // Criar categoria se não existir
        if (!categoryId) {
          console.log(`   🆕 Criando categoria: ${categoryName}`);
          const { data: newCategory, error: catError } = await supabase
            .from('categories')
            .insert({ nome: categoryName })
            .select()
            .single();
          
          if (catError) throw catError;
          
          categoryId = newCategory.id;
          categoryMap[categoryName] = categoryId;
          categoriesCreated++;
        }
        
        // Buscar produtos duplicados (mesmo nome ou imagem)
        const { data: duplicates } = await supabase
          .from('products')
          .select('id')
          .or(`nome.eq.${item.nome},imagem1.eq.${item.imagem1}`);
        
        // Deletar duplicados
        if (duplicates && duplicates.length > 0) {
          for (const dup of duplicates) {
            await supabase.from('products').delete().eq('id', dup.id);
            deleted++;
          }
        }
        
        // Criar produto
        const { data: newProduct, error: createError } = await supabase
          .from('products')
          .insert({
            nome: item.descricao, // Usar descrição como nome completo
            descricao: item.descricao,
            categoria_id: categoryId,
            imagem1: item.imagem1,
            custo: item.custo,
            margem_pct: item.margem_pct || 10,
            ativo: true
          })
          .select()
          .single();
        
        if (createError) throw createError;
        
        created++;
        console.log(`   ✅ ${item.descricao.substring(0, 50)}... - R$ ${item.custo}`);
        
        // Vincular ao lote
        const { error: linkError } = await supabase
          .from('lot_products')
          .insert({
            lot_id: lotId,
            product_id: newProduct.id
          });
        
        if (!linkError) {
          linked++;
        }
        
      } catch (itemError) {
        console.error(`   ❌ Erro em "${item.nome}": ${itemError.message}`);
      }
    }
    
    // Resumo
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO DA IMPORTAÇÃO');
    console.log('='.repeat(60));
    console.log(`🆕 Categorias criadas: ${categoriesCreated}`);
    console.log(`🗑️  Produtos duplicados removidos: ${deleted}`);
    console.log(`✨ Produtos criados: ${created}`);
    console.log(`🔗 Produtos vinculados ao lote: ${linked}`);
    console.log(`📦 Total processado: ${productsData.length}`);
    console.log('='.repeat(60) + '\n');
    
    console.log('✅ Importação concluída com sucesso!');
    
  } catch (error) {
    console.error('\n❌ Erro na importação:', error.message);
    process.exit(1);
  }
}

importProducts();
