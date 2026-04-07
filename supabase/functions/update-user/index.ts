import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { id, nome, telefone, email, role, instagram, cpf, aniversario, grupo, approved, cadastro_status, enderecos } = await req.json();

    if (!id || !nome || !telefone) {
      return new Response(
        JSON.stringify({ error: 'ID, nome e telefone são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Get current client data to find auth_id
    const { data: client, error: fetchError } = await supabaseAdmin
      .from('clients')
      .select('auth_id, telefone')
      .eq('id', id)
      .single();

    if (fetchError || !client) {
      throw new Error('Cliente não encontrado');
    }

    const authId = client.auth_id;
    const oldTelefone = client.telefone;
    const newTelefoneDigits = telefone.replace(/\D/g, '');
    const oldTelefoneDigits = oldTelefone ? oldTelefone.replace(/\D/g, '') : '';

    // 2. Update Auth User if phone changed
    if (authId && newTelefoneDigits !== oldTelefoneDigits) {
      const newAuthEmail = `${newTelefoneDigits}@artea.local`;
      
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        authId,
        { 
          email: newAuthEmail,
          user_metadata: { 
            name: nome,
            role: role || 'cliente',
            email_real: email
          }
        }
      );

      if (authError) {
        console.error('Auth update error:', authError);
        throw new Error(`Erro ao atualizar autenticação: ${authError.message}`);
      }
      console.log(`Auth email updated to: ${newAuthEmail}`);
    } else if (authId) {
        // Update metadata even if phone didn't change
        await supabaseAdmin.auth.admin.updateUserById(
            authId,
            { 
              user_metadata: { 
                name: nome,
                role: role || 'cliente',
                email_real: email
              }
            }
          );
    }

    // 3. Update Client Record
    const { error: clientError } = await supabaseAdmin
      .from('clients')
      .update({
        nome,
        telefone: newTelefoneDigits,
        email: email || null,
        role: role || 'cliente',
        instagram: instagram !== undefined ? (instagram || null) : undefined,
        cpf: cpf !== undefined ? (cpf || null) : undefined,
        aniversario: aniversario !== undefined ? (aniversario || null) : undefined,
        grupo: grupo || undefined,
        approved: approved !== undefined ? approved : undefined,
        cadastro_status: cadastro_status || undefined,
        enderecos: enderecos !== undefined ? enderecos : undefined
      })
      .eq('id', id);

    if (clientError) {
      throw clientError;
    }

    return new Response(
      JSON.stringify({ message: 'Usuário atualizado com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
