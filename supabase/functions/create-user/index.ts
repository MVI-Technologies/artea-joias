import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { email, password, nome, telefone, role, instagram, cpf, aniversario, grupo, approved, cadastro_status, enderecos } = await req.json();

    if (!email || !password || !nome) {
        return new Response(
            JSON.stringify({ error: 'Email, password and name are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // 0. Validation: Check if email or phone already exists in clients
    // ... existing validation code ...
    const { data: existingClients, error: checkError } = await supabase
      .from('clients')
      .select('id, email, telefone')
      .or(`email.eq.${email},telefone.eq.${telefone}`);

    if (existingClients && existingClients.length > 0) {
        return new Response(
            JSON.stringify({ error: 'Usuário (email ou telefone) já cadastrado no sistema.' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // 1. Create user in Supabase Auth
    // ... existing auth creation code ...
    const phoneDigits = telefone.replace(/\D/g, '');
    const authEmail = `${phoneDigits}@artea.local`;
    
    // We send 'legacy_migration': 'true' to bypass the handle_new_user trigger
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        name: nome,
        role: role || 'cliente',
        legacy_migration: 'true',
        email_real: email // Store real email in metadata
      }
    });

    if (authError) {
      console.error('Auth create error:', authError);
      throw new Error(`Erro ao criar usuário na autenticação: ${authError.message}`);
    }

    const userId = authData.user.id;

    // 2. Create record in clients table
    // We set both id and auth_id to userId for consistency
    const { error: clientError } = await supabase
      .from('clients')
      .insert({
        id: userId,
        auth_id: userId,
        email, // Store the REAL email here
        nome,
        telefone,
        role: role || 'cliente',
        instagram: instagram || null,
        cpf: cpf || null,
        aniversario: aniversario || null,
        grupo: grupo || 'Grupo Compras',
        cadastro_status: cadastro_status || 'completo', 
        approved: approved !== undefined ? approved : true,
        enderecos: enderecos || []
      });

    if (clientError) {
      console.error('Client text insert error:', clientError);
      // Rollback: delete the auth user if client record creation fails
      await supabase.auth.admin.deleteUser(userId);
      throw new Error(`Erro ao criar cliente: ${clientError.message}`);
    }

    return new Response(
      JSON.stringify({ user: authData.user, message: 'User created successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
