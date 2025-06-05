import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gahnpzedurpgilixtppr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhaG5wemVkdXJwZ2lsaXh0cHByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxMzgxOTEsImV4cCI6MjA2MzcxNDE5MX0.RaDL8FsdzpDWzIoNHssdYxGitKHRPMFY_wtjtcEMf0o'

export const supabase = createClient(supabaseUrl, supabaseKey)