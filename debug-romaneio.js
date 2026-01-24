
import { createClient } from '@supabase/supabase-js'

const url = 'https://ziefqkgdfbutsaolbemt.supabase.co'
const key = 'sb_publishable_Wb67x9R1g5sb1ARY3SHTXg_q-wZ26lQ'
const supabase = createClient(url, key)

async function test() {
  console.log('Teste hipótese: dados e dados_pagamento...')
  
  const { data: client } = await supabase.from('clients').select('id').limit(1).single()
  const { data: lot } = await supabase.from('lots').select('id').limit(1).single()

  const fakeRomaneio = {
    lot_id: lot.id,
    client_id: client.id,
    numero_romaneio: `TEST-${Date.now()}`,
    status_pagamento: 'aguardando_pagamento',
    quantidade_itens: 1,
    valor_produtos: 10,
    valor_total: 10,
    status: 'gerado', 
    numero_pedido: `PED-${Date.now()}`,
    dados_pagamento: {}, // JSONB
    dados: {} // JSONB
  }

  const { data, error } = await supabase
    .from('romaneios')
    .insert(fakeRomaneio)
    .select()
    .single()

  if (error) {
      console.log('MSG:', error.message)
      console.log('DTL:', error.details)
  } else {
      console.log('SUCESSO COM DADOS E DADOS_PAGAMENTO!')
      await supabase.from('romaneios').delete().eq('id', data.id)
  }
}

test()
