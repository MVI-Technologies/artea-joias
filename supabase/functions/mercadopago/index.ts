import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  // Criar cliente Supabase com Admin Key (para chamar RPC security definer)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // Apenas POST
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const { type, data } = await req.json()

    // Logar evento (opcional)
    console.log('Webhook received:', type, data)

    // Mercado Pago envia notification com type='payment' e data.id
    if (type === 'payment') {
      const paymentId = data.id

      // Consultar API do MP para garantir status real (Segurança Sênior)
      // Aqui usamos fetch direto na API do MP
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')}`
        }
      })

      if (!mpResponse.ok) {
        throw new Error('Falha ao validar pagamento no MP')
      }

      const paymentData = await mpResponse.json()
      const status = paymentData.status
      const externalRef = paymentData.external_reference // Nosso Order ID
      const valor = paymentData.transaction_amount

      // Chamar nossa RPC segura
      const { data: rpcData, error } = await supabase.rpc('process_payment_webhook', {
        p_external_ref: externalRef,
        p_payment_id: String(paymentId),
        p_status: status,
        p_valor: valor
      })

      if (error) throw error

      return new Response(JSON.stringify(rpcData), { 
        headers: { "Content-Type": "application/json" } 
      })
    }

    return new Response(JSON.stringify({ received: true }), { 
      headers: { "Content-Type": "application/json" } 
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400,
      headers: { "Content-Type": "application/json" } 
    })
  }
})
