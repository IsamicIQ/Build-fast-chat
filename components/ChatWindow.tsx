'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Message, User } from '@/lib/supabase'
import { format } from 'date-fns'
import { getUserDisplayName, getMessageContent, hasMessageImage } from '@/lib/helpers'
import MessageInput from './MessageInput'
import MessageStatusIcon from './MessageStatusIcon'
import ImageViewer from './ImageViewer'
import MessageSearch from './MessageSearch'
import ReactionPicker from './ReactionPicker'
import OnlineStatus from './OnlineStatus'
import TypingIndicator from './TypingIndicator'
import UserAvatar from './UserAvatar'

interface ChatWindowProps {
  currentUserId: string
  otherUserId: string
  onOpenProfile?: (userId: string) => void
}

export default function ChatWindow({
  currentUserId,
  otherUserId,
  onOpenProfile,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [otherUser, setOtherUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [pinned, setPinned] = useState<any[]>([])
  const [showReactionsFor, setShowReactionsFor] = useState<string | null>(null)
  const [reactionsByMessage, setReactionsByMessage] = useState<Record<string, { [emoji: string]: string[] }>>({})
  const [deletedForMeIds, setDeletedForMeIds] = useState<Set<string>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadOtherUser()
    loadMessages()
    loadPins()
    const cleanup = setupRealtime()
    markMessagesAsRead()
    
    return () => {
      if (cleanup) cleanup()
    }
  }, [otherUserId, currentUserId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadOtherUser = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', otherUserId)
      .single()

    if (data) setOtherUser(data)
  }

  const loadMessages = async () => {
    // Check if other user is blocked
    const { data: blockedCheck } = await supabase
      .from('blocked_users')
      .select('*')
      .or(`and(blocker_id.eq.${currentUserId},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${currentUserId})`)
      .single()

    // If blocked, don't show messages
    if (blockedCheck) {
      setMessages([])
      setLoading(false)
      return
    }

    // Try loading direct messages first (with receiver_id)
    let { data, error } = await supabase
      .from('messages')
      .select('*, sender:users!messages_sender_id_fkey(*)')
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`
      )
      .order('created_at', { ascending: true })

    // If no direct messages, try loading via conversation participants
    if ((!data || data.length === 0) && !error) {
      const { data: convData } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUserId)
        .limit(1)
        .single()

      if (convData) {
        const { data: msgData } = await supabase
          .from('messages')
          .select('*, sender:users!messages_sender_id_fkey(*)')
          .eq('conversation_id', convData.conversation_id)
          .order('created_at', { ascending: true })
        
        data = msgData
      }
    }

    if (error) {
      console.error('Error loading messages:', error)
      return
    }

    const loaded = data || []
    // Fetch per-user deletions and reactions
    const ids = loaded.map((m: any) => m.id)
    if (ids.length > 0) {
      const { data: delRows } = await supabase
        .from('message_deletions')
        .select('message_id')
        .in('message_id', ids)
        .eq('user_id', currentUserId)

      setDeletedForMeIds(new Set((delRows || []).map((d: any) => d.message_id)))

      const { data: reactRows } = await supabase
        .from('message_reactions')
        .select('message_id, emoji, user_id')
        .in('message_id', ids)

      const map: Record<string, { [emoji: string]: string[] }> = {}
      ;(reactRows || []).forEach((r: any) => {
        if (!map[r.message_id]) map[r.message_id] = {}
        if (!map[r.message_id][r.emoji]) map[r.message_id][r.emoji] = []
        map[r.message_id][r.emoji].push(r.user_id)
      })
      setReactionsByMessage(map)
    }

    setMessages(loaded)
    setLoading(false)
  }

  const setupRealtime = () => {
    // Subscribe to messages sent TO the current user (from other user)
    const incomingChannel = supabase
      .channel(`incoming:${currentUserId}:${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${currentUserId}`,
        },
        (payload) => {
          console.log('Incoming message received:', payload)
          const newMessage = payload.new as any
          // Only process if it's from the other user
          if (newMessage.sender_id === otherUserId) {
            loadMessages()
            markMessagesAsDelivered()
          }
        }
      )
      .subscribe((status) => {
        console.log('Incoming channel status:', status)
      })

    // Subscribe to messages sent BY the current user (so other user sees them)
    // This listens for messages where we are the sender
    const outgoingChannel = supabase
      .channel(`outgoing:${currentUserId}:${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${currentUserId}`,
        },
        (payload) => {
          console.log('Outgoing message sent:', payload)
          const newMessage = payload.new as any
          // Only process if it's to the other user
          if (newMessage.receiver_id === otherUserId) {
            loadMessages()
          }
        }
      )
      .subscribe((status) => {
        console.log('Outgoing channel status:', status)
      })

    // Listen for message updates (status changes)
    const updateChannel = supabase
      .channel(`updates:${currentUserId}:${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `sender_id=eq.${currentUserId}`,
        },
        () => {
          console.log('Message status updated')
          loadMessages()
        }
      )
      .subscribe()

    // Listen for app open/visibility to mark as delivered
    const visibilityHandler = () => {
      if (!document.hidden) {
        markMessagesAsDelivered()
      }
    }
    document.addEventListener('visibilitychange', visibilityHandler)

    return () => {
      supabase.removeChannel(incomingChannel)
      supabase.removeChannel(outgoingChannel)
      supabase.removeChannel(updateChannel)
      document.removeEventListener('visibilitychange', visibilityHandler)
    }
  }

  const markMessagesAsDelivered = async () => {
    // Mark messages sent to current user as delivered
    await supabase
      .from('messages')
      .update({ status: 'delivered' })
      .eq('receiver_id', currentUserId)
      .eq('sender_id', otherUserId)
      .eq('status', 'sent')
  }

  const markMessagesAsRead = async () => {
    // Mark messages as read when chat is opened
    await supabase
      .from('messages')
      .update({ status: 'read' })
      .eq('receiver_id', currentUserId)
      .eq('sender_id', otherUserId)
      .in('status', ['sent', 'delivered'])
  }

  const loadPins = async () => {
    const convId = await getConversationId()
    if (!convId) { setPinned([]); return }
    const { data } = await supabase
      .from('pinned_messages')
      .select('*, message:messages(*)')
      .eq('conversation_id', convId)
      .order('pinned_at', { ascending: false })
    setPinned(data || [])
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleNewMessage = async (content: string, imageUrl?: string) => {
    try {
      // Check if user is blocked
      const { data: blockedCheck, error: blockError } = await supabase
        .from('blocked_users')
        .select('*')
        .or(`and(blocker_id.eq.${otherUserId},blocked_id.eq.${currentUserId}),and(blocker_id.eq.${currentUserId},blocked_id.eq.${otherUserId})`)
        .single()

      if (blockedCheck) {
        throw new Error('You cannot send messages to this user (blocked)')
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          receiver_id: otherUserId,
          content: content || '',
          image_url: imageUrl,
          status: 'sent',
        })
        .select()
        .single()

      if (error) {
        console.error('Error sending message:', error)
        throw new Error('Failed to send message. Please try again.')
      }

      // Update status to delivered immediately if receiver is online
      // (In a real app, you'd check presence)
      setTimeout(async () => {
        await supabase
          .from('messages')
          .update({ status: 'delivered' })
          .eq('id', data.id)
          .eq('status', 'sent')
      }, 500)

      loadMessages()
    } catch (error: any) {
      console.error('Error in handleNewMessage:', error)
      throw error
    }
  }

  const draftKey = `draft:direct:${[currentUserId, otherUserId].sort().join(':')}`

  const toggleReaction = async (messageId: string, emoji: string) => {
    try {
      const existing = reactionsByMessage[messageId]?.[emoji]?.includes(currentUserId)
      if (existing) {
        await supabase
          .from('message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', currentUserId)
          .eq('emoji', emoji)
      } else {
        await supabase
          .from('message_reactions')
          .insert({ message_id: messageId, user_id: currentUserId, emoji })
      }
      loadMessages()
    } catch (e) {
      console.error('Reaction error', e)
    }
  }

  const canModify = (m: any) => {
    return m.sender_id === currentUserId && (new Date().getTime() - new Date(m.created_at).getTime()) <= 10 * 60 * 1000
  }

  const editMessage = async (m: any) => {
    if (!canModify(m)) return alert('You can only edit your message within 10 minutes')
    const next = window.prompt('Edit message', m.content || '')
    if (next === null) return
    await supabase.from('messages').update({ content: next, edited_at: new Date().toISOString() }).eq('id', m.id)
    loadMessages()
  }

  const deleteForMe = async (m: any) => {
    await supabase.from('message_deletions').insert({ message_id: m.id, user_id: currentUserId })
    loadMessages()
  }

  const deleteForEveryone = async (m: any) => {
    if (!canModify(m)) return alert('You can only delete within 10 minutes')
    await supabase.from('messages').update({ is_deleted: true, content: '' }).eq('id', m.id)
    loadMessages()
  }

  const getConversationId = async (): Promise<string | null> => {
    const u1 = currentUserId < otherUserId ? currentUserId : otherUserId
    const u2 = currentUserId < otherUserId ? otherUserId : currentUserId
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .eq('is_group', false)
      .single()
    return data?.id || null
  }

  const pinMessage = async (m: any) => {
    const convId = await getConversationId()
    if (!convId) return alert('Conversation not found')
    await supabase.from('pinned_messages').insert({ conversation_id: convId, message_id: m.id, pinned_by: currentUserId })
    loadMessages()
  }

  const filteredMessages = searchQuery
    ? messages.filter(
        (msg) => {
          const content = getMessageContent(msg).toLowerCase()
          return content.includes(searchQuery.toLowerCase()) ||
            (hasMessageImage(msg) && searchQuery.toLowerCase() === 'image')
        }
      )
    : messages

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">Loading messages...</div>
      </div>
    )
  }

  if (!otherUser) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">User not found</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <div 
            onClick={() => onOpenProfile?.(otherUserId)}
            className="flex items-center gap-3 flex-1 cursor-pointer hover:bg-gray-50 -m-2 p-2 rounded-lg transition-colors"
          >
            <UserAvatar user={otherUser} size="md" />
            <div>
              <div className="font-semibold flex items-center gap-2">
                {getUserDisplayName(otherUser)}
                <OnlineStatus userId={otherUserId} />
              </div>
              <div className="text-xs text-gray-500">@{otherUser.username || otherUser.email?.split('@')[0]}</div>
            </div>
          </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(true)}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Search messages"
          >
            🔍
          </button>
        </div>
      </div>

      {/* Pinned bar */}
      {pinned.length > 0 && (
        <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-200 text-sm flex items-center gap-2">
          📌 {pinned.length} pinned {pinned.length === 1 ? 'message' : 'messages'}
        </div>
      )}

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-2 bg-gray-50"
      >
        {filteredMessages
          .filter((m) => !deletedForMeIds.has(m.id))
          .map((message, index) => {
          const isOwn = message.sender_id === currentUserId
          const showDate =
            index === 0 ||
            new Date(message.created_at).toDateString() !==
              new Date(filteredMessages[index - 1].created_at).toDateString()

          return (
            <div key={message.id}>
              {showDate && (
                <div className="text-center text-xs text-gray-500 my-4">
                  {format(new Date(message.created_at), 'MMMM d, yyyy')}
                </div>
              )}
              <div
                id={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    isOwn
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-900'
                  }`}
                >
                  {hasMessageImage(message) && (
                    <div className="mb-2">
                      <img
                        src={message.image_url || ''}
                        alt="Shared"
                        onClick={() => setSelectedImage(message.image_url!)}
                        className="max-w-full h-auto rounded cursor-pointer hover:opacity-90"
                      />
                    </div>
                  )}
                  {message.is_deleted ? (
                    <div className="italic text-sm opacity-80">Message deleted</div>
                  ) : getMessageContent(message) ? (
                    <div className="whitespace-pre-wrap">
                      {getMessageContent(message)} {message.edited_at && <span className="text-xs opacity-70">(edited)</span>}
                    </div>
                  ) : null}
                  <div
                    className={`text-xs mt-1 flex items-center gap-1 ${
                      isOwn ? 'text-primary-100' : 'text-gray-500'
                    }`}
                  >
                    {format(new Date(message.created_at), 'HH:mm')}
                    {isOwn && message.status && (
                      <MessageStatusIcon
                        status={message.status}
                        className="ml-1"
                      />
                    )}
                  </div>
                </div>
              </div>
              {/* Reactions row */}
              {reactionsByMessage[message.id] && (
                <div className={`mt-1 flex gap-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  {Object.entries(reactionsByMessage[message.id]).map(([emoji, users]) => (
                    <button
                      key={emoji}
                      onClick={() => toggleReaction(message.id, emoji)}
                      className={`px-2 py-0.5 rounded-full text-xs border ${users.includes(currentUserId) ? 'bg-primary-100 border-primary-200' : 'bg-gray-50 border-gray-200'}`}
                      title={users.length === 1 ? '1 reaction' : `${users.length} reactions`}
                    >
                      {emoji} {users.length}
                    </button>
                  ))}
                </div>
              )}

              {/* Action bar */}
              <div className={`mt-1 flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <button onClick={() => setShowReactionsFor(showReactionsFor === message.id ? null : message.id)} className="text-xs text-gray-500 hover:underline">React</button>
                {isOwn && !message.is_deleted && (
                  <>
                    <button onClick={() => editMessage(message)} className="text-xs text-gray-500 hover:underline">Edit</button>
                    <button onClick={() => deleteForMe(message)} className="text-xs text-gray-500 hover:underline">Delete for me</button>
                    <button onClick={() => deleteForEveryone(message)} className="text-xs text-red-600 hover:underline">Delete for everyone</button>
                  </>
                )}
                {!message.is_deleted && <button onClick={() => pinMessage(message)} className="text-xs text-gray-500 hover:underline">Pin</button>}
              </div>

              {showReactionsFor === message.id && (
                <div className={`mt-1 ${isOwn ? 'justify-end' : 'justify-start'} flex`}>
                  <ReactionPicker onSelect={(emoji) => { toggleReaction(message.id, emoji); setShowReactionsFor(null) }} />
                </div>
              )}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      <TypingIndicator
        otherUserId={otherUserId}
        currentUserId={currentUserId}
      />

      {/* Message Input */}
      <MessageInput 
        draftKey={draftKey}
        onSendMessage={handleNewMessage}
        onTyping={(typing) => {
          // Broadcast typing status
          const channelName = `typing:direct:${otherUserId}:${currentUserId}`
          const channel = supabase.channel(channelName)
          
          if (typing) {
            channel.send({
              type: 'broadcast',
              event: 'typing',
              payload: { 
                userId: currentUserId, 
                userName: getUserDisplayName({ 
                  id: currentUserId, 
                  email: '', 
                  username: '', 
                  full_name: '', 
                  name: '' 
                }) 
              },
            })
          }
        }}
      />

      {/* Search Modal */}
      {showSearch && (
        <MessageSearch
          messages={messages}
          onClose={() => {
            setShowSearch(false)
            setSearchQuery('')
          }}
          onSelectMessage={(messageId) => {
            setShowSearch(false)
            setSearchQuery('')
            // Scroll to message after a brief delay to ensure DOM is updated
            setTimeout(() => {
              const element = document.getElementById(messageId)
              if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                // Highlight briefly
                const originalBg = element.style.backgroundColor
                element.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'
                setTimeout(() => {
                  element.style.backgroundColor = originalBg
                }, 2000)
              }
            }, 100)
          }}
        />
      )}

      {/* Image Viewer */}
      {selectedImage && (
        <ImageViewer
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  )
}

