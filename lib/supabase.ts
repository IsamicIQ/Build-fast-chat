import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// Validate environment variables
const isPlaceholder = supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder')

if (typeof window !== 'undefined' && isPlaceholder) {
  console.error('❌ CRITICAL: Supabase environment variables are not set!')
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET')
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET (but wrong)' : 'NOT SET')
  console.error('📝 ACTION REQUIRED:')
  console.error('   1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables')
  console.error('   2. Add NEXT_PUBLIC_SUPABASE_URL = https://qzppgcfjsdpocaqsaqli.supabase.co')
  console.error('   3. Add NEXT_PUBLIC_SUPABASE_ANON_KEY = your_full_anon_key')
  console.error('   4. Make sure to check "Production", "Preview", and "Development"')
  console.error('   5. Save and redeploy the application')
}

// Use per-tab storage to prevent logout in one tab from logging out other tabs
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // sessionStorage is scoped to the tab/window; fallback is undefined on SSR
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Types
export interface User {
  id: string
  email?: string
  name?: string
  full_name?: string
  username?: string
  avatar_url?: string
  profile_picture?: string
  created_at?: string
}

export interface Message {
  id: string
  sender_id: string
  receiver_id?: string
  conversation_id?: string
  content?: string
  message_text?: string
  image_url?: string
  status?: 'sent' | 'delivered' | 'read'
  is_deleted?: boolean
  edited_at?: string
  created_at: string
  sender?: User
  receiver?: User
}

export interface Conversation {
  id: string
  user1_id: string
  user2_id: string
  last_message_at: string
  user1?: User
  user2?: User
}

export interface BlockedUser {
  id: string
  blocker_id: string
  blocked_id: string
  created_at: string
  blocked_user?: User
}

