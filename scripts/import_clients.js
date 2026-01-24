
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
// Note: Requires SERVICE_ROLE_KEY to bypass RLS if RLS is enforced, or just anon if RLS policies allow insert.
// Since we disabled RLS in previous steps (Phase 1), anon key might work, but service role is better for "admin" tasks.
// Using whatever is available. Ideally specific service role key.

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Erro: VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY (ou ANON) são obrigatórios no .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const FILE_PATH = path.resolve(process.cwd(), 'arteajoias-export-customers-2026-01-24.xlsx');

async function importClients() {
  console.log('🚀 Iniciando importação de clientes...');
  console.log(`📂 Arquivo: ${FILE_PATH}`);

  if (!fs.existsSync(FILE_PATH)) {
    console.error('❌ Arquivo não encontrado!');
    process.exit(1);
  }

  // 1. Read Excel
  const workbook = XLSX.readFile(FILE_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`📊 Total de linhas encontradas: ${rows.length}`);

  let imported = 0;
  let ignored = 0;
  let errors = 0;

  // 2. Fetch existing clients to prevent duplicates
  // Ideally we query one by one or fetch all fields to match. 
  // For safety, let's fetch emails and phones.
  const { data: existingData, error: fetchError } = await supabase
    .from('clients')
    .select('email, telefone, cpf');
  
  if (fetchError) {
    console.error('❌ Erro ao buscar clientes existentes:', fetchError.message);
    process.exit(1);
  }

  const existingEmails = new Set(existingData.map(c => c.email).filter(Boolean));
  const existingPhones = new Set(existingData.map(c => c.telefone).filter(Boolean));
  const existingCpfs = new Set(existingData.map(c => c.cpf).filter(Boolean)); // If CPF exists

  for (const row of rows) {
    try {
      // Mapping
      const rawName = row['Nome Completo'];
      const rawPhone = row['WhatsApp']; // Telefone
      const rawEmail = row['Email'];
      const rawRevendedora = row['Revendedora'];
      const rawDate = row['Data Criação']; // Might be Excel serial date or string
      // Ignore: "Última Compra Varejo", "Saldo Devedor", "Grupo?" (unless useful)

      // Validation: Name is mandatory
      if(!rawName) {
        console.warn(`⚠️ Ignorado: Nome ausente. Row: ${JSON.stringify(row)}`);
        errors++;
        continue;
      }

      // 3. Normalization
      const nome = rawName.trim();
      
      // Telefone: Remove non-digits
      let telefone = rawPhone ? String(rawPhone).replace(/\D/g, '') : null;
      // Ensure specific format if needed (e.g. 55 prefix). Assuming raw input is enough for now or simple clean.
      // If empty, fail? User says "Caso algum campo obrigatório ausente...". 
      // DB has "telefone TEXT NOT NULL UNIQUE". So it IS mandatory.
      if (!telefone) {
        console.warn(`⚠️ Ignorado: Telefone inválido/ausente para ${nome}`);
        errors++;
        continue;
      }

      // Email: optional validation
      const email = rawEmail ? String(rawEmail).trim().toLowerCase() : null;
      if (email && existingEmails.has(email)) {
        console.log(`⏭️ Ignorado (Duplicado Email): ${email}`);
        ignored++;
        continue;
      }

      if (existingPhones.has(telefone)) {
        console.log(`⏭️ Ignorado (Duplicado Telefone): ${telefone} - ${nome}`);
        ignored++;
        continue;
      }

      // CPF: Not available in excel based on inspection? Or maybe hidden in "Grupo?".
      // Assuming no CPF column. If provided in a future col, normalize.
      // User says "documento (CPF/CNPJ)". If absent, skip field.
      // If DB requires it (it doesn't per schema), we're good.
      // Assuming no duplicate check on empty CPF.

      // Tipo / Grupo
      // User: "Revendedora" == "Sim" -> revendedora
      const isRevendedora = rawRevendedora && String(rawRevendedora).trim().toLowerCase() === 'sim';
      const grupo = isRevendedora ? 'Revendedora' : 'Grupo Compras'; // Or 'Cliente Final'? Defaulting to schema default or 'Grupo Compras'
      
      // Role
      const role = 'cliente'; 

      // Data Criacao
      // Excel to Date
      let createdAt = new Date();
      if (rawDate) {
        if (typeof rawDate === 'number') {
            // Excel serial date to JS Date
            createdAt = new Date((rawDate - (25567 + 2)) * 86400 * 1000); 
        } else {
            createdAt = new Date(rawDate);
        }
      }
      if (isNaN(createdAt.getTime())) createdAt = new Date();

      // Ativo
      const approved = true; 

      // 4. Insert
      const payload = {
        nome,
        telefone,
        email: email || null, // Handle empty string
        grupo,
        role,
        approved,
        created_at: createdAt.toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('clients')
        .insert(payload);

      if (insertError) {
        console.error(`❌ Erro inserindo ${nome}: ${insertError.message}`);
        errors++;
      } else {
        console.log(`✅ Importado: ${nome} (${grupo})`);
        imported++;
        // Update local sets to catch duplicates within the file itself
        if (email) existingEmails.add(email);
        existingPhones.add(telefone);
      }

    } catch (err) {
      console.error(`❌ Erro inesperado processando linha:`, err);
      errors++;
    }
  }

  console.log('--- Resumo Importação ---');
  console.log(`✅ Importados: ${imported}`);
  console.log(`⏭️ Ignorados: ${ignored}`);
  console.log(`❌ Erros: ${errors}`);
}

importClients();
