'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function TestSearch() {
  const [users, setUsers] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth')
      return
    }

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
    
    setCurrentUser(profile)

    const { data: allUsers } = await supabase
      .from('users')
      .select('*')
      .neq('id', user.id)
      .limit(20)

    setUsers(allUsers || [])
  }

  const startChat = async (otherUserId: string) => {
    const user1Id = currentUser.id < otherUserId ? currentUser.id : otherUserId
    const user2Id = currentUser.id < otherUserId ? otherUserId : currentUser.id

    const { data: existingConv } = await supabase
      .from('conversations')
      .select('*')
      .eq('user1_id', user1Id)
      .eq('user2_id', user2Id)
      .eq('is_group', false)
      .single()

    if (!existingConv) {
      await supabase
        .from('conversations')
        .insert({
          user1_id: user1Id,
          user2_id: user2Id,
          is_group: false,
          last_message_at: new Date().toISOString(),
        })
    }

    alert('Conversation started! Go back to home and refresh.')
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Test Search - All Users</h1>
        
        {currentUser && (
          <div className="mb-4 p-3 bg-blue-50 rounded">
            <strong>Current User:</strong> {currentUser.email}
          </div>
        )}

        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="p-3 border rounded-lg flex items-center justify-between hover:bg-gray-50"
            >
              <div>
                <div className="font-medium">{user.username || user.name || user.full_name}</div>
                <div className="text-sm text-gray-500">{user.email}</div>
              </div>
              <button
                onClick={() => startChat(user.id)}
                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
              >
                Start Chat
              </button>
            </div>
          ))}
        </div>

        {users.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            No other users found. Create another account to test!
          </div>
        )}

        <div className="mt-6">
          <a
            href="/"
            className="inline-block px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}

