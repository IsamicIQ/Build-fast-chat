'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/supabase'
import { getUserDisplayName } from '@/lib/helpers'
import UserAvatar from './UserAvatar'

interface CreateGroupChatProps {
  currentUserId: string
  onClose: () => void
  onGroupCreated: (groupId: string, groupName: string) => void
}

export default function CreateGroupChat({
  currentUserId,
  onClose,
  onGroupCreated,
}: CreateGroupChatProps) {
  const [groupName, setGroupName] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [searchQuery])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const loadUsers = async () => {
    let query = supabase
      .from('users')
      .select('*')
      .neq('id', currentUserId)
      .limit(20)

    if (searchQuery.trim()) {
      query = query.or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
    }

    const { data } = await query
    setUsers(data || [])
  }

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUsers(newSelected)
  }

  const handleCreate = async () => {
    if (!groupName.trim() || selectedUsers.size === 0) {
      alert('Please enter a group name and select at least one member')
      return
    }

    setLoading(true)
    try {
      // Call the database function to create group
      const { data, error } = await supabase.rpc('create_group_conversation', {
        p_group_name: groupName,
        p_creator_id: currentUserId,
        p_member_ids: Array.from(selectedUsers),
      })

      if (error) throw error

      onGroupCreated(data, groupName)
    } catch (error: any) {
      console.error('Error creating group:', error)
      alert('Failed to create group: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold">Create Group Chat</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Group Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Group Name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Search Users */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Add Members ({selectedUsers.size} selected)
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-3"
            />
          </div>

          {/* User List */}
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.id}
                onClick={() => toggleUser(user.id)}
                className={`p-3 border rounded-lg cursor-pointer flex items-center gap-3 ${
                  selectedUsers.has(user.id)
                    ? 'bg-primary-50 border-primary-500'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <UserAvatar user={user} size="md" className="flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{getUserDisplayName(user)}</div>
                  <div className="text-sm text-gray-500 truncate">{user.email}</div>
                </div>
                {selectedUsers.has(user.id) && (
                  <div className="text-primary-600 flex-shrink-0">✓</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleCreate}
            disabled={loading || !groupName.trim() || selectedUsers.size === 0}
            className="w-full bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  )
}

