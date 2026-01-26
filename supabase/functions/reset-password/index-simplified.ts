// Supabase Edge Function - Reset de Senha
// Deploy: Cole este código no editor do Supabase Dashboard

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Parse request body
        let body;
        try {
            body = await req.json();
        } catch (jsonError) {
            return new Response(
                JSON.stringify({ success: false, error: 'Corpo da requisição inválido ou vazio' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const { code, telefone, newPassword } = body;

        if (!code || !telefone || !newPassword) {
            return new Response(
                JSON.stringify({ success: false, error: 'Código, telefone e nova senha são obrigatórios' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Get Supabase credentials from environment
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseServiceKey) {
            return new Response(
                JSON.stringify({ success: false, error: 'Configuração do servidor incompleta' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const telefoneLimpo = telefone.replace(/\D/g, '');

        // Validar código usando fetch direto (sem createClient)
        const validateResponse = await fetch(`${supabaseUrl}/rest/v1/password_reset_codes?code=eq.${code}&telefone=eq.${telefoneLimpo}&used=eq.false&expires_at=gt.${new Date().toISOString()}&select=*,client:clients(*)`, {
            headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        });

        const resetData = await validateResponse.json();

        if (!validateResponse.ok || !resetData || resetData.length === 0) {
            return new Response(
                JSON.stringify({ success: false, error: 'Código inválido ou expirado' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const resetRecord = resetData[0];

        // Buscar email do cliente no Supabase Auth
        const phoneWithoutCountryCode = telefoneLimpo.startsWith('55') ? telefoneLimpo.slice(2) : telefoneLimpo;
        const phoneWithCountryCode = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`;

        const emailVariations = [
            `${phoneWithoutCountryCode}@artea.local`,
            `${phoneWithCountryCode}@artea.local`,
            `+${phoneWithCountryCode}@artea.local`,
        ];

        let authUser = null;
        for (const email of emailVariations) {
            try {
                const userResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
                    headers: {
                        'apikey': supabaseServiceKey,
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                        'Content-Type': 'application/json'
                    }
                });

                const userData = await userResponse.json();

                if (userResponse.ok && userData && userData.users && userData.users.length > 0) {
                    authUser = userData.users[0];
                    console.log(`✅ Usuário encontrado com email: ${email}`);
                    break;
                }
            } catch (err) {
                console.log(`Tentando próximo email...`);
            }
        }

        if (!authUser) {
            return new Response(
                JSON.stringify({ success: false, error: 'Usuário não encontrado no sistema de autenticação' }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Atualizar senha usando Admin API
        const updateResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUser.id}`, {
            method: 'PUT',
            headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                password: newPassword
            })
        });

        if (!updateResponse.ok) {
            const errorData = await updateResponse.json();
            console.error('Erro ao atualizar senha:', errorData);
            return new Response(
                JSON.stringify({ success: false, error: 'Erro ao atualizar senha' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Marcar código como usado
        await fetch(`${supabaseUrl}/rest/v1/password_reset_codes?id=eq.${resetRecord.id}`, {
            method: 'PATCH',
            headers: {
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ used: true })
        });

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
