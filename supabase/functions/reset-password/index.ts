// Supabase Edge Function - Reset de Senha
// Deploy: supabase functions deploy reset-password

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, telefone, newPassword } = await req.json();

    if (!code || !telefone || !newPassword) {
      return new Response(
        JSON.stringify({ success: false, error: 'Código, telefone e nova senha são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar cliente Supabase com service role (tem permissões admin)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const telefoneLimpo = telefone.replace(/\D/g, '');

    // Validar código
    const { data: resetData, error: resetError } = await supabaseAdmin
      .from('password_reset_codes')
      .select('*, client:clients(*)')
      .eq('code', code)
      .eq('telefone', telefoneLimpo)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (resetError || !resetData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Código inválido ou expirado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar email do cliente no Supabase Auth
    const emailVariations = [
      `${telefoneLimpo}@artea.local`,
      `+55${telefoneLimpo}@artea.local`,
      `55${telefoneLimpo}@artea.local`,
    ];

    let authUser = null;
    for (const email of emailVariations) {
      try {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserByEmail(email);
        if (!authError && authData?.user) {
          authUser = authData.user;
          break;
        }
      } catch (err) {
        // Continuar tentando
      }
    }

    if (!authUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não encontrado no sistema de autenticação' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar senha no Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authUser.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Erro ao atualizar senha:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao atualizar senha' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Marcar código como usado
    await supabaseAdmin
      .from('password_reset_codes')
      .update({ used: true })
      .eq('id', resetData.id);

    return new Response(
      JSON.stringify({ success: true, message: 'Senha alterada com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função reset-password:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
