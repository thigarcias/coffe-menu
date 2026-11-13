import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(window.location.origin, 'auth-proxy', {
  auth: { detectSessionInUrl: false, storageKey: 'cm.admin.session' },
})
