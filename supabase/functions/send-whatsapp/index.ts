// Supabase Edge Function - Envio de WhatsApp via Evolution API
// Deploy: supabase functions deploy send-whatsapp

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Configurações da Evolution API (definidas como secrets no Supabase)
const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL')
const EVOLUTION_API_TOKEN = Deno.env.get('EVOLUTION_API_TOKEN')
const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE') || 'artea'

interface SendMessageRequest {
  to: string
  message: string
}

interface BulkMessageRequest {
  recipients: Array<{ telefone: string; nome: string }>
  message: string
}

function formatPhoneNumber(phone: string): string {
  // Remover caracteres não numéricos
  let cleaned = phone.replace(/\D/g, '')
  
  // Se não começar com 55 (Brasil), adicionar
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned
  }
  
  return cleaned
}

async function sendSingleMessage(to: string, message: string) {
  const formattedNumber = formatPhoneNumber(to)
  
  const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_TOKEN!
    },
    body: JSON.stringify({
      number: formattedNumber,
      text: message
    })
  })

  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.message || 'Erro ao enviar mensagem')
  }

  return data
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar se a API está configurada
    if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Evolution API não configurada no servidor' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verificar autenticação do usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Criar cliente Supabase para verificar permissões
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verificar se usuário é admin
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: clientData } = await supabaseClient
      .from('clients')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!clientData || clientData.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Apenas administradores podem enviar mensagens' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Processar request
    const body = await req.json()
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'single'

    if (action === 'single') {
      // Envio individual
      const { to, message } = body as SendMessageRequest
      
      if (!to || !message) {
        return new Response(
          JSON.stringify({ success: false, error: 'Parâmetros inválidos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const result = await sendSingleMessage(to, message)
      
      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } 
    else if (action === 'bulk') {
      // Envio em massa
      const { recipients, message } = body as BulkMessageRequest
      
      if (!recipients || !message || recipients.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'Parâmetros inválidos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const results = {
        success: 0,
        errors: 0,
        details: [] as Array<{ nome: string; success: boolean; error?: string }>
      }

      for (const recipient of recipients) {
        try {
          // Substituir variáveis na mensagem
          const personalizedMessage = message.replace(/%Nome%/gi, recipient.nome || 'Cliente')
          
          await sendSingleMessage(recipient.telefone, personalizedMessage)
          results.success++
          results.details.push({ nome: recipient.nome, success: true })
        } catch (error) {
          results.errors++
          results.details.push({ 
            nome: recipient.nome, 
            success: false, 
            error: error.message 
          })
        }

        // Delay entre mensagens para não sobrecarregar a API
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: results 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro na Edge Function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

