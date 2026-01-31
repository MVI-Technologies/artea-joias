import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables from .env file
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in your .env file.')
  console.error('Current values:')
  console.error('URL:', supabaseUrl)
  console.error('Key:', supabaseServiceKey ? '******' : 'undefined')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function backfillAuthIds() {
  console.log('Starting migration: Backfilling auth_id for clients...')

  // 1. Fetch clients without auth_id
  const { data: clients, error } = await supabase
    .from('clients')
    .select('*')
    .is('auth_id', null)

  if (error) {
    console.error('Error fetching clients:', error)
    return
  }

  console.log(`Found ${clients.length} clients pending migration.`)

  if (clients.length === 0) {
    console.log('No clients to migrate.')
    return
  }

  let successCount = 0
  let errorCount = 0

  for (const client of clients) {
    console.log(`\nProcessing: ${client.email} (${client.nome})`)
    
    // Calculate authEmail (phone-based) just in case we need it for lookup
    // Logic matches Edge Function: digits only + @artea.local
    const phoneDigits = (client.telefone || '').replace(/\D/g, '');
    const authEmail = `${phoneDigits}@artea.local`;
    
    // 2. Create Auth User
    // We use a temporary password. The flow assumes admin will trigger password reset or user cleans it up.
    // Or we could try to set it to a known default if requested, but random/temp is safer.
    
    // Check if user already exists in Auth to avoid dupes?
    // The admin.createUser will throw if email exists.
    
    try {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: client.email,
        password: 'ChangeMe123!', // Temporary password
        email_confirm: true,
        user_metadata: {
            name: client.nome,
            role: client.role || 'cliente',
            legacy_migration: 'true',
            email_real: client.email
        }
        })

        let userId = null

        if (authError) {
            console.log(`  Creation failed. Checking if user exists in Auth...`)
            
            // Unconditionally try to find the user, since the error might be "duplicate" with varying messages.
            let foundUser = null;
            let page = 1;
            const perPage = 50;
            let hasMore = true;

            while (hasMore && !foundUser) {
                const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
                    page: page,
                    perPage: perPage
                })
                
                if (listError) {
                    console.error('    Error listing users:', listError)
                    break;
                }

                const users = listData.users || [];
                if (users.length === 0) {
                    hasMore = false;
                    break;
                }

                foundUser = users.find(u => 
                    (u.email && u.email.toLowerCase() === client.email.toLowerCase()) || 
                    (u.email && u.email.toLowerCase() === authEmail.toLowerCase())
                );
                
                if (!foundUser) {
                     // Also check metadata??
                     foundUser = users.find(u => u.user_metadata?.email_real === client.email);
                }

                page++;
            }

            if (foundUser) {
                    userId = foundUser.id;
                    console.log(`  Found existing Auth User: ${userId} (${foundUser.email}). Linking...`);
            } else {
                console.error(`  Could not find Auth User for ${client.email} in listUsers.`);
                console.error(`  Original Error: ${authError.message}`);
                errorCount++
                continue
            }
        } else {
             userId = authData.user.id
             console.log(`  Created Auth User: ${userId}`)
        }

        if (userId) {
            // 3. Update Client Record
            const { error: updateError } = await supabase
                .from('clients')
                .update({ auth_id: userId })
                .eq('id', client.id)

            if (updateError) {
                if (updateError.message.includes('clients_auth_id_key') || updateError.code === '23505') {
                     console.error(`  Error: Auth User ${userId} is ALREADY linked to another client!`)
                     // Find who holds it
                     const { data: holder, error: holderError } = await supabase
                        .from('clients')
                        .select('id, nome, email, telefone')
                        .eq('auth_id', userId)
                        .single()
                     
                     if (holder) {
                         console.error(`    Conflict with Client: ${holder.nome} (ID: ${holder.id}, Email: ${holder.email})`)
                         // Here we could suggest merging or deleting, but for now just report.
                     }
                } else {
                    console.error(`  Error updating client record: ${updateError.message}`)
                }
                // Cleaning up auth user would be good here but optional for script simplicity
                errorCount++
            } else {
                console.log(`  Successfully linked auth_id.`)
                successCount++
            }
        }

    } catch (err) {
        console.error('  Unexpected error:', err)
        errorCount++
    }
  }

  console.log('\nMigration Summary:')
  console.log(`  Total Processed: ${clients.length}`)
  console.log(`  Success: ${successCount}`)
  console.log(`  Errors: ${errorCount}`)
}

backfillAuthIds()
