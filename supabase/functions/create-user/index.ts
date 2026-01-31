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
    const { data: existingClients, error: checkError } = await supabase
      .from('clients')
      .select('id, email, telefone, auth_id')
      .or(`email.eq.${email},telefone.eq.${telefone}`);

    let clientToUpdateId = null;

    if (existingClients && existingClients.length > 0) {
        // Check if any has auth_id
        const registered = existingClients.find(c => c.auth_id);
        if (registered) {
            return new Response(
                JSON.stringify({ error: 'Usuário (email ou telefone) já cadastrado no sistema.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
        
        // No auth_id found. We can backfill.
        // Prioritize matching by email, otherwise take the first one (phone match)
        const match = existingClients.find(c => c.email === email) || existingClients[0];
        clientToUpdateId = match.id;
        console.log(`Backfilling auth for existing client: ${clientToUpdateId}`);
    }

    // 1. Create user in Supabase Auth
    // Use phone as email identifier pattern if strictly needed or just use the provided email?
    // The original code used phoneDigits@artea.local. Checking if we should preserve that.
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

    // 2. Create or Update record in clients table
    let clientError;

    if (clientToUpdateId) {
        // Update existing client
        const { error } = await supabase
          .from('clients')
          .update({
            auth_id: userId,
            // Ensure essential fields are synced/updated if provided
            email: email, 
            role: role || 'cliente',
            // Only update these if they are provided to avoid overwriting with null
            ...(instagram ? { instagram } : {}),
            ...(cpf ? { cpf } : {}),
            ...(aniversario ? { aniversario } : {}),
            ...(grupo ? { grupo } : {}),
            ...(enderecos ? { enderecos } : {})
          })
          .eq('id', clientToUpdateId);
          
        clientError = error;
    } else {
        // Insert new client
        // We set both id and auth_id to userId for consistency (legacy behavior preference)
        const { error } = await supabase
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
          
        clientError = error;
    }

    if (clientError) {
      console.error('Client text insert/update error:', clientError);
      // Rollback: delete the auth user if client record creation fails
      await supabase.auth.admin.deleteUser(userId);
      throw new Error(`Erro ao criar/atualizar cliente: ${clientError.message}`);
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
