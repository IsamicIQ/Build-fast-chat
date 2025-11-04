'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/supabase'
import { getUserDisplayName } from '@/lib/helpers'
import UserAvatar from './UserAvatar'

interface ProfileModalProps {
  currentUserId: string
  profileUserId: string
  onClose: () => void
  onBlock: () => void
}

export default function ProfileModal({
  currentUserId,
  profileUserId,
  onClose,
  onBlock,
}: ProfileModalProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isBlocked, setIsBlocked] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProfile()
    checkBlocked()
  }, [profileUserId])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const loadProfile = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', profileUserId)
      .single()

    if (data) setUser(data)
    setLoading(false)
  }

  const checkBlocked = async () => {
    const { data } = await supabase
      .from('blocked_users')
      .select('*')
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', profileUserId)
      .single()

    setIsBlocked(!!data)
  }

  const handleBlock = async () => {
    if (isBlocked) {
      // Unblock
      await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', currentUserId)
        .eq('blocked_id', profileUserId)
      setIsBlocked(false)
    } else {
      // Block
      await supabase.from('blocked_users').insert({
        blocker_id: currentUserId,
        blocked_id: profileUserId,
      })
      setIsBlocked(true)
      onBlock()
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">User Profile</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="text-center mb-6">
            <div className="mx-auto mb-4 w-24 h-24 flex items-center justify-center">
              <UserAvatar user={user} size="xl" />
            </div>
            <h3 className="text-xl font-semibold mb-1">{getUserDisplayName(user)}</h3>
            <p className="text-gray-600 mb-1">@{user.username || user.email?.split('@')[0]}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <button
              onClick={handleBlock}
              className={`w-full py-3 rounded-lg font-medium ${
                isBlocked
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {isBlocked ? 'Unblock User' : 'Block User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

