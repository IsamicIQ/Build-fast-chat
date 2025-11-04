'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { User } from '@/lib/supabase'
import { getUserDisplayName, getMessageContent } from '@/lib/helpers'

interface UserSearchProps {
  currentUserId: string
  onClose: () => void
  onSelectUser: (userId: string) => void
}

export default function UserSearch({
  currentUserId,
  onClose,
  onSelectUser,
}: UserSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{
    users: User[]
    conversations: any[]
    messages: any[]
  }>({
    users: [],
    conversations: [],
    messages: [],
  })
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'users' | 'chats' | 'messages'>('all')
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([])

  useEffect(() => {
    loadSuggestedUsers()
  }, [])

  useEffect(() => {
    if (query.trim()) {
      search()
    } else {
      setResults({ users: [], conversations: [], messages: [] })
    }
  }, [query])

  const loadSuggestedUsers = async () => {
    // Load all non-blocked users (no relevance filter)
    const { data: blockedData } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', currentUserId)

    const blockedIds = new Set((blockedData || []).map((b) => b.blocked_id))
    blockedIds.add(currentUserId)

    let usersQuery = supabase
      .from('users')
      .select('*')
      .neq('id', currentUserId)
      .order('name', { ascending: true })
      .order('email', { ascending: true })

    // Apply blocking filter
    if (blockedIds.size > 1) {
      const blockedArray = Array.from(blockedIds).filter(id => id !== currentUserId)
      if (blockedArray.length > 0) {
        usersQuery = usersQuery.not('id', 'in', `(${blockedArray.join(',')})`)
      }
    }

    const { data, error } = await usersQuery
    
    if (error) {
      console.error('Error loading suggested users:', error)
    }
    
    console.log('📋 Suggested users loaded (all):', data?.length || 0, 'users')
    
    setSuggestedUsers(data || [])
  }

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const search = async () => {
    setLoading(true)
    const searchQuery = query.trim().toLowerCase()

    // Check if user is blocked
    const { data: blockedData } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', currentUserId)

    const blockedIds = new Set((blockedData || []).map((b) => b.blocked_id))
    blockedIds.add(currentUserId)

    // Search users: return all non-blocked users, regardless of relevance
    let usersQuery = supabase
      .from('users')
      .select('*')
      .neq('id', currentUserId) // Don't show self
      .order('name', { ascending: true })
      .order('email', { ascending: true })

    // Apply blocking filter if there are blocked users
    if (blockedIds.size > 1) { // More than just current user
      const blockedArray = Array.from(blockedIds).filter(id => id !== currentUserId)
      if (blockedArray.length > 0) {
        usersQuery = usersQuery.not('id', 'in', `(${blockedArray.join(',')})`)
      }
    }

    // Intentionally do not filter by search query to show all users

    const { data: usersData, error: usersError } = await usersQuery
    
    if (usersError) {
      console.error('Error searching users:', usersError)
    }
    console.log('🔍 User list (all users regardless of query). Query typed:', searchQuery)
    console.log('Users returned:', usersData?.length || 0)

    // Search conversations
    const { data: conversationsData } = await supabase
      .from('conversations')
      .select(`
        *,
        user1:users!conversations_user1_id_fkey(*),
        user2:users!conversations_user2_id_fkey(*)
      `)
      .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
      .order('last_message_at', { ascending: false })

    const filteredConversations = (conversationsData || []).filter((conv) => {
      const otherUser = conv.user1_id === currentUserId ? conv.user2 : conv.user1
      const displayName = getUserDisplayName(otherUser).toLowerCase()
      return (
        displayName.includes(searchQuery) ||
        otherUser.email.toLowerCase().includes(searchQuery)
      )
    })

    // Search messages
    const { data: messagesData } = await supabase
      .from('messages')
      .select('*, sender:users!messages_sender_id_fkey(*)')
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.not.in.(${Array.from(blockedIds).join(',')})),and(receiver_id.eq.${currentUserId},sender_id.not.in.(${Array.from(blockedIds).join(',')}))`
      )
      .ilike('content', `%${searchQuery}%`)
      .order('created_at', { ascending: false })
      .limit(20)

    setResults({
      users: usersData || [],
      conversations: filteredConversations,
      messages: messagesData || [],
    })
    setLoading(false)
  }

  const handleSelectUser = async (userId: string) => {
    // Create or get conversation with this user
    const user1Id = currentUserId < userId ? currentUserId : userId
    const user2Id = currentUserId < userId ? userId : currentUserId

    // Check if conversation exists
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('*')
      .eq('user1_id', user1Id)
      .eq('user2_id', user2Id)
      .eq('is_group', false)
      .single()

    if (!existingConv) {
      // Create new conversation
      await supabase
        .from('conversations')
        .insert({
          user1_id: user1Id,
          user2_id: user2Id,
          is_group: false,
          last_message_at: new Date().toISOString(),
        })
    }

    onSelectUser(userId)
  }

  const handleSelectConversation = (conv: any) => {
    const otherUserId = conv.user1_id === currentUserId ? conv.user2_id : conv.user1_id
    onSelectUser(otherUserId)
  }

  const handleSelectMessage = (message: any) => {
    const otherUserId = message.sender_id === currentUserId ? message.receiver_id : message.sender_id
    onSelectUser(otherUserId)
  }

  const displayResults = () => {
    if (activeTab === 'all') {
      return {
        users: results.users,
        conversations: results.conversations,
        messages: results.messages,
      }
    } else if (activeTab === 'users') {
      return { users: results.users, conversations: [], messages: [] }
    } else if (activeTab === 'chats') {
      return { users: [], conversations: results.conversations, messages: [] }
    } else {
      return { users: [], conversations: [], messages: results.messages }
    }
  }

  const { users, conversations, messages } = displayResults()
  const hasResults = users.length > 0 || conversations.length > 0 || messages.length > 0

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 z-40 flex items-start justify-center pt-20">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search users, conversations, messages..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
            />
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Close
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {(['all', 'users', 'chats', 'messages'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-sm rounded ${
                  activeTab === tab
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Searching...</div>
          ) : !query.trim() ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  💬 Suggested Users to Chat With
                </h3>
                <button
                  onClick={() => {
                    console.log('🔄 Refreshing suggested users...')
                    loadSuggestedUsers()
                  }}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  🔄 Refresh
                </button>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                People using the app you can start chatting with
              </p>
              {suggestedUsers.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <div className="text-4xl mb-2">👥</div>
                  <p className="font-medium">No other users yet</p>
                  <p className="text-xs mt-2">Create another account or invite friends to chat!</p>
                  <button
                    onClick={() => {
                      console.log('🔄 Manual refresh clicked')
                      loadSuggestedUsers()
                    }}
                    className="mt-3 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"
                  >
                    🔄 Refresh List
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {suggestedUsers.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => handleSelectUser(user.id)}
                      className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 flex items-center gap-3"
                    >
                      {user.profile_picture ? (
                        <img
                          src={user.profile_picture}
                          alt={getUserDisplayName(user)}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center font-semibold">
                          {getUserDisplayName(user).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium">{getUserDisplayName(user)}</div>
                        <div className="text-sm text-gray-500">@{user.username || user.email?.split('@')[0]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : !hasResults ? (
            <div className="text-center text-gray-400 py-8">
              <div className="text-4xl mb-2">🔍</div>
              <p className="font-medium">No results found</p>
              <p className="text-xs mt-2">Try searching for a different name, username, or email</p>
              {query.length < 2 && (
                <p className="text-xs text-primary-600 mt-2">Tip: Type at least 2 characters to search</p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Users */}
              {users.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Users ({users.length})
                  </h3>
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        onClick={() => handleSelectUser(user.id)}
                        className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 flex items-center gap-3"
                      >
                        {user.profile_picture ? (
                          <img
                            src={user.profile_picture}
                            alt={getUserDisplayName(user)}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center font-semibold">
                            {getUserDisplayName(user).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{getUserDisplayName(user)}</div>
                          <div className="text-sm text-gray-500">@{user.username || user.email?.split('@')[0]}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversations */}
              {conversations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Conversations ({conversations.length})
                  </h3>
                  <div className="space-y-2">
                    {conversations.map((conv) => {
                      const otherUser = conv.user1_id === currentUserId ? conv.user2 : conv.user1
                      return (
                        <div
                          key={conv.id}
                          onClick={() => handleSelectConversation(conv)}
                          className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 flex items-center gap-3"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center font-semibold">
                            {getUserDisplayName(otherUser).charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{getUserDisplayName(otherUser)}</div>
                            <div className="text-sm text-gray-500">{otherUser.email}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Messages */}
              {messages.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Messages ({messages.length})
                  </h3>
                  <div className="space-y-2">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        onClick={() => handleSelectMessage(message)}
                        className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-semibold">
                            {getUserDisplayName(message.sender).charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-medium">
                            {getUserDisplayName(message.sender)}
                          </span>
                        </div>
                        <div className="text-sm text-gray-700 line-clamp-2">
                          {getMessageContent(message) || (message.image_url && '📷 Image')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

