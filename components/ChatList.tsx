'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { User, Conversation } from '@/lib/supabase'
import { format } from 'date-fns'
import { getUserDisplayName } from '@/lib/helpers'
import UserAvatar from './UserAvatar'

interface ChatListProps {
  currentUserId: string
  onSelectUser: (userId: string) => void
  onSelectGroup: (conversationId: string, groupName: string) => void
  selectedUserId: string | null
  selectedConversationId?: string | null
  onOpenProfile: (userId: string) => void
}

export default function ChatList({
  currentUserId,
  onSelectUser,
  onSelectGroup,
  selectedUserId,
  selectedConversationId,
  onOpenProfile,
}: ChatListProps) {
  const [conversations, setConversations] = useState<any[]>([])
  const [groupConversations, setGroupConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadConversations()
    loadGroupConversations()
    setupRealtime()
  }, [currentUserId])

  const loadConversations = async () => {
    // Try loading the new conversation structure first
    let { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        user1:users!conversations_user1_id_fkey(*),
        user2:users!conversations_user2_id_fkey(*)
      `)
      .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
      .order('last_message_at', { ascending: false })

    // If no data, try loading via conversation_participants
    if ((!data || data.length === 0) && !error) {
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations!inner(*)
        `)
        .eq('user_id', currentUserId)

      if (participants) {
        // Load other participants for each conversation
        const convIds = participants.map(p => p.conversation_id)
        // For now, just set empty - we'll need to handle group chats differently
        data = []
      }
    }

    if (error) {
      console.error('Error loading conversations:', error)
    }

    // Format conversations with the other user
    const formatted = (data || []).map((conv: any) => {
      const otherUser =
        conv.user1_id === currentUserId ? conv.user2 : conv.user1
      return {
        ...conv,
        otherUser,
      }
    })

    setConversations(formatted)
    setLoading(false)
  }

  const loadGroupConversations = async () => {
    const { data: participantData } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', currentUserId)

    if (!participantData || participantData.length === 0) return

    const conversationIds = participantData.map(p => p.conversation_id)

    const { data } = await supabase
      .from('conversations')
      .select('*')
      .in('id', conversationIds)
      .eq('is_group', true)
      .order('last_message_at', { ascending: false })

    setGroupConversations(data || [])
  }

  const setupRealtime = () => {
    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          loadConversations()
          loadGroupConversations()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }

  if (loading) {
    return (
      <div className="flex-1 p-4 text-center text-gray-400">
        Loading conversations...
      </div>
    )
  }

  if (conversations.length === 0 && groupConversations.length === 0) {
    return (
      <div className="flex-1 p-4 text-center text-gray-400">
        No conversations yet. Start a chat!
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide">
      {/* Group Chats */}
      {groupConversations.map((conv: any) => (
        <div
          key={conv.id}
          onClick={() => onSelectGroup(conv.id, conv.group_name)}
          className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
            selectedConversationId === conv.id ? 'bg-blue-50' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center font-semibold flex-shrink-0">
              {conv.group_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold truncate">{conv.group_name}</h3>
                <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                  {format(new Date(conv.last_message_at), 'HH:mm')}
                </span>
              </div>
              <div className="text-xs text-gray-500">Group Chat</div>
            </div>
          </div>
        </div>
      ))}

      {/* Direct Chats */}
      {conversations.map((conv) => (
        <div
          key={conv.id}
          onClick={() => onSelectUser(conv.otherUser.id)}
          className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
            selectedUserId === conv.otherUser.id ? 'bg-blue-50' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <UserAvatar user={conv.otherUser} size="lg" className="flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold truncate">{getUserDisplayName(conv.otherUser)}</h3>
                <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                  {format(new Date(conv.last_message_at), 'HH:mm')}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

