// Supabase Edge Function - Envio de WhatsApp via Evolution API
// Deploy: supabase functions deploy send-whatsapp
// 
// PROTEÇÕES ANTI-BAN IMPLEMENTADAS:
// - Delay aleatório entre mensagens (3-8 segundos)
// - Pausa maior a cada lote de mensagens
// - Variação no tempo para simular comportamento humano
// - Limite máximo de mensagens por execução

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configurações da Evolution API (definidas como secrets no Supabase)
const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
const EVOLUTION_API_TOKEN = Deno.env.get('EVOLUTION_API_TOKEN');
const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE') || 'artea';

// ============================================
// CONFIGURAÇÕES ANTI-BAN (ajuste conforme necessário)
// ============================================
const ANTI_BAN_CONFIG = {
  // Delay mínimo entre mensagens (em ms)
  MIN_DELAY: 4000,  // 4 segundos
  
  // Delay máximo entre mensagens (em ms)
  MAX_DELAY: 10000, // 10 segundos
  
  // A cada X mensagens, fazer uma pausa maior
  BATCH_SIZE: 10,
  
  // Pausa maior após cada lote (em ms)
  BATCH_PAUSE_MIN: 30000,  // 30 segundos
  BATCH_PAUSE_MAX: 60000,  // 60 segundos
  
  // Máximo de mensagens por execução (0 = sem limite)
  MAX_MESSAGES_PER_EXECUTION: 100,
  
  // Adicionar pequenas variações no texto para evitar detecção de spam
  ADD_INVISIBLE_VARIATION: true,
};

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Gera um delay aleatório entre min e max
 */
function getRandomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Aguarda um tempo específico (Promise-based)
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Formata número de telefone para o padrão brasileiro
 */
function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

/**
 * Adiciona variação invisível ao texto para evitar detecção de mensagens idênticas
 * Usa caracteres zero-width que são invisíveis mas tornam cada mensagem única
 */
function addInvisibleVariation(text: string): string {
  if (!ANTI_BAN_CONFIG.ADD_INVISIBLE_VARIATION) return text;
  
  // Caracteres zero-width invisíveis
  const invisibleChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
  
  // Adiciona 2-4 caracteres invisíveis aleatórios no final
  const numChars = Math.floor(Math.random() * 3) + 2;
  let variation = '';
  
  for (let i = 0; i < numChars; i++) {
    variation += invisibleChars[Math.floor(Math.random() * invisibleChars.length)];
  }
  
  return text + variation;
}

/**
 * Envia uma única mensagem via Evolution API
 */
async function sendSingleMessage(to: string, message: string) {
  const formattedNumber = formatPhoneNumber(to);
  
  console.log(`📤 Enviando para: ${formattedNumber}`);
  
  const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVOLUTION_API_TOKEN || ''
    },
    body: JSON.stringify({
      number: formattedNumber,
      text: message
    })
  });

  const responseText = await response.text();
  
  let data;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(`Resposta inválida da API: ${responseText.substring(0, 100)}`);
  }
  
  if (!response.ok) {
    throw new Error(data?.message || `Erro ${response.status}`);
  }

  return data;
}

// ============================================
// HANDLER PRINCIPAL
// ============================================

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('=== 🚀 INICIANDO FUNÇÃO WHATSAPP ===');
    console.log('⏰ Horário:', new Date().toISOString());
    
    // Verificar configuração da API
    if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Evolution API não configurada. Verifique os Secrets no Supabase.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'single';

    console.log('📋 Action:', action);

    // =====================================
    // ENVIO INDIVIDUAL
    // =====================================
    if (action === 'single') {
      const { to, message } = body;
      
      if (!to || !message) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Parâmetros inválidos: "to" e "message" são obrigatórios' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const finalMessage = addInvisibleVariation(message);
      const result = await sendSingleMessage(to, finalMessage);
      
      console.log('✅ Mensagem individual enviada com sucesso');
      
      return new Response(
        JSON.stringify({ success: true, data: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } 
    
    // =====================================
    // ENVIO EM MASSA (COM PROTEÇÕES ANTI-BAN)
    // =====================================
    else if (action === 'bulk') {
      const { recipients, message } = body;
      
      if (!recipients || !message || recipients.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Parâmetros inválidos: "recipients" e "message" são obrigatórios' 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar limite máximo de mensagens
      const maxMessages = ANTI_BAN_CONFIG.MAX_MESSAGES_PER_EXECUTION;
      let recipientsToProcess = recipients;
      
      if (maxMessages > 0 && recipients.length > maxMessages) {
        console.log(`⚠️ Limite de ${maxMessages} mensagens por execução. Processando apenas os primeiros.`);
        recipientsToProcess = recipients.slice(0, maxMessages);
      }

      console.log(`📊 Total de destinatários: ${recipientsToProcess.length}`);
      console.log(`⏱️ Delay entre mensagens: ${ANTI_BAN_CONFIG.MIN_DELAY}-${ANTI_BAN_CONFIG.MAX_DELAY}ms`);
      console.log(`📦 Pausa a cada ${ANTI_BAN_CONFIG.BATCH_SIZE} mensagens`);

      const results = {
        success: 0,
        errors: 0,
        total: recipientsToProcess.length,
        details: [] as Array<{ nome: string; success: boolean; error?: string }>
      };

      const startTime = Date.now();

      for (let i = 0; i < recipientsToProcess.length; i++) {
        const recipient = recipientsToProcess[i];
        const messageNumber = i + 1;
        
        try {
          // Substituir variáveis e adicionar variação
          let personalizedMessage = message.replace(/%Nome%/gi, recipient.nome || 'Cliente');
          personalizedMessage = addInvisibleVariation(personalizedMessage);
          
          console.log(`\n📨 [${messageNumber}/${recipientsToProcess.length}] Enviando para: ${recipient.nome}`);
          
          await sendSingleMessage(recipient.telefone, personalizedMessage);
          
          results.success++;
          results.details.push({ nome: recipient.nome, success: true });
          
          console.log(`✅ [${messageNumber}] Sucesso!`);
          
        } catch (err: any) {
          console.error(`❌ [${messageNumber}] Erro para ${recipient.nome}:`, err?.message);
          results.errors++;
          results.details.push({ 
            nome: recipient.nome, 
            success: false, 
            error: err?.message || 'Erro desconhecido' 
          });
        }

        // =====================================
        // DELAYS ANTI-BAN
        // =====================================
        
        // Não aplicar delay após a última mensagem
        if (i < recipientsToProcess.length - 1) {
          
          // Verificar se é hora de fazer pausa maior (a cada BATCH_SIZE mensagens)
          if ((i + 1) % ANTI_BAN_CONFIG.BATCH_SIZE === 0) {
            const batchPause = getRandomDelay(
              ANTI_BAN_CONFIG.BATCH_PAUSE_MIN, 
              ANTI_BAN_CONFIG.BATCH_PAUSE_MAX
            );
            console.log(`\n⏸️ Pausa de lote: aguardando ${(batchPause / 1000).toFixed(1)} segundos...`);
            await sleep(batchPause);
          } else {
            // Delay normal entre mensagens
            const delay = getRandomDelay(
              ANTI_BAN_CONFIG.MIN_DELAY, 
              ANTI_BAN_CONFIG.MAX_DELAY
            );
            console.log(`⏳ Aguardando ${(delay / 1000).toFixed(1)} segundos...`);
            await sleep(delay);
          }
        }
      }

      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(`\n=== 📊 RESUMO DO ENVIO ===`);
      console.log(`✅ Sucesso: ${results.success}`);
      console.log(`❌ Erros: ${results.errors}`);
      console.log(`⏱️ Tempo total: ${totalTime} segundos`);
      console.log(`📈 Média por mensagem: ${(parseFloat(totalTime) / recipientsToProcess.length).toFixed(1)} segundos`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          data: {
            ...results,
            executionTime: `${totalTime}s`,
            averagePerMessage: `${(parseFloat(totalTime) / recipientsToProcess.length).toFixed(1)}s`
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação não reconhecida. Use "single" ou "bulk".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('💥 ERRO NA FUNÇÃO:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
