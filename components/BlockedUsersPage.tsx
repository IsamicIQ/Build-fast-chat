'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/supabase'
import { getUserDisplayName } from '@/lib/helpers'

interface BlockedUsersPageProps {
  currentUserId: string
  onBack: () => void
}

export default function BlockedUsersPage({
  currentUserId,
  onBack,
}: BlockedUsersPageProps) {
  const [blockedUsers, setBlockedUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBlockedUsers()
  }, [currentUserId])

  const loadBlockedUsers = async () => {
    const { data, error } = await supabase
      .from('blocked_users')
      .select(`
        *,
        blocked_user:users!blocked_users_blocked_id_fkey(*)
      `)
      .eq('blocker_id', currentUserId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading blocked users:', error)
      return
    }

    setBlockedUsers(data || [])
    setLoading(false)
  }

  const handleUnblock = async (blockedId: string) => {
    const { error } = await supabase
      .from('blocked_users')
      .delete()
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', blockedId)

    if (error) {
      console.error('Error unblocking user:', error)
      alert('Failed to unblock user')
      return
    }

    loadBlockedUsers()
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-full bg-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold">Blocked Users</h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Loading...</div>
          ) : blockedUsers.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              No blocked users
            </div>
          ) : (
            <div className="space-y-3">
              {blockedUsers.map((blocked) => {
                const user = blocked.blocked_user
                if (!user) return null

                return (
                  <div
                    key={blocked.id}
                    className="p-4 border border-gray-200 rounded-lg flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary-500 text-white flex items-center justify-center font-semibold">
                        {getUserDisplayName(user).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold">{getUserDisplayName(user)}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnblock(user.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Unblock
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

