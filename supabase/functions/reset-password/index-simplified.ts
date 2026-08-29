// Supabase Edge Function - Reset de Senha (clientes legados, por telefone)
//
// Fluxo: telefone -> encontra o cliente em `clients` -> exige um novo
// e-mail (que passa a ser a identidade de login) + nova senha -> aplica
// os dois no Supabase Auth via Admin API.
//
// Decisão de produto (explícita, ver conversa): NÃO há verificação de
// posse do telefone (nenhum código enviado por WhatsApp/SMS — decisão
// reafirmada: nenhuma dependência de WhatsApp em nenhum fluxo) nem do
// e-mail (nenhum link de confirmação) — a única barreira é saber o
// telefone cadastrado do cliente. Isso é mais fraco do que uma
// verificação por código; ver aviso de risco no relatório da tarefa
// que introduziu este fluxo.
//
// Deploy: Cole este código no editor do Supabase Dashboard

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        let body;
        try {
            body = await req.json();
        } catch (jsonError) {
            return new Response(
                JSON.stringify({ success: false, error: 'Corpo da requisição inválido ou vazio' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { telefone, newEmail, newPassword } = body;

        if (!telefone || !newEmail || !newPassword) {
            return new Response(
                JSON.stringify({ success: false, error: 'Telefone, e-mail e nova senha são obrigatórios' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const emailNormalizado = String(newEmail).trim().toLowerCase();
        if (!EMAIL_REGEX.test(emailNormalizado)) {
            return new Response(
                JSON.stringify({ success: false, error: 'E-mail inválido' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (String(newPassword).length < 6) {
            return new Response(
                JSON.stringify({ success: false, error: 'A senha deve ter pelo menos 6 caracteres' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceKey) {
            return new Response(
                JSON.stringify({ success: false, error: 'Configuração do servidor incompleta' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const serviceHeaders = {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
        };

        // Encontrar o cliente pelo telefone, tolerando variações de DDI
        // (mesma lógica já usada em ForgotPasswordLegacy.jsx/AuthContext).
        const telefoneLimpo = telefone.replace(/\D/g, '');
        const telefoneSem55 = telefoneLimpo.startsWith('55') ? telefoneLimpo.slice(2) : telefoneLimpo;
        const telefoneCom55 = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`;
        const orFilter = `telefone.eq.${telefoneLimpo},telefone.eq.${telefoneSem55},telefone.eq.${telefoneCom55}`;

        const clientResponse = await fetch(
            `${supabaseUrl}/rest/v1/clients?select=id,auth_id,email&or=(${orFilter})&limit=1`,
            { headers: serviceHeaders }
        );
        const clients = await clientResponse.json();

        if (!clientResponse.ok || !Array.isArray(clients) || clients.length === 0) {
            return new Response(
                JSON.stringify({ success: false, error: 'Telefone não encontrado no sistema' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const client = clients[0];

        if (!client.auth_id) {
            return new Response(
                JSON.stringify({ success: false, error: 'Cliente não possui conta de autenticação vinculada' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // E-mail já em uso por OUTRO cliente? (idx_clients_email_unique cobre
        // isso no banco, mas checar aqui dá uma mensagem amigável em vez do
        // erro cru da constraint.)
        const dupResponse = await fetch(
            `${supabaseUrl}/rest/v1/clients?select=id&email=ilike.${encodeURIComponent(emailNormalizado)}&id=neq.${client.id}&limit=1`,
            { headers: serviceHeaders }
        );
        const dupRows = await dupResponse.json();
        if (dupResponse.ok && Array.isArray(dupRows) && dupRows.length > 0) {
            return new Response(
                JSON.stringify({ success: false, error: 'Este e-mail já está cadastrado em outra conta' }),
                { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Atualiza e-mail + senha no Auth em uma única chamada.
        const updateResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${client.auth_id}`, {
            method: 'PUT',
            headers: serviceHeaders,
            body: JSON.stringify({
                email: emailNormalizado,
                password: newPassword,
                email_confirm: true,
            })
        });

        if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            console.error('Erro ao atualizar e-mail/senha:', errorData);
            const msg = String(errorData?.msg || errorData?.message || '').toLowerCase();
            const emailEmUso = msg.includes('already been registered') || msg.includes('already exists') || msg.includes('duplicate');
            return new Response(
                JSON.stringify({
                    success: false,
                    error: emailEmUso ? 'Este e-mail já está cadastrado em outra conta' : 'Erro ao atualizar e-mail/senha'
                }),
                { status: emailEmUso ? 409 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Mantém clients.email em sincronia com auth.users.email.
        await fetch(`${supabaseUrl}/rest/v1/clients?id=eq.${client.id}`, {
            method: 'PATCH',
            headers: { ...serviceHeaders, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ email: emailNormalizado })
        });

        return new Response(
            JSON.stringify({ success: true, message: 'E-mail e senha atualizados com sucesso' }),
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
