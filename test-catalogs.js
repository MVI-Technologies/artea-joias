import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

async function run() {
  const { data, error } = await supabase
    .from('lots')
    .select('id, nome, link_compra, cover_image_url, numero_link, status')
    
  console.log('Todos os catálogos:', data.map(d => ({
    nome: d.nome,
    status: d.status,
    tem_capa: !!d.cover_image_url
  })))
}

run()
