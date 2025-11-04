'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Message, User } from '@/lib/supabase'
import { format } from 'date-fns'
import { getUserDisplayName, getMessageContent, hasMessageImage } from '@/lib/helpers'
import MessageInput from './MessageInput'
import ImageViewer from './ImageViewer'
import TypingIndicator from './TypingIndicator'
import UserAvatar from './UserAvatar'

interface GroupChatWindowProps {
  currentUserId: string
  conversationId: string
  groupName: string
}

export default function GroupChatWindow({
  currentUserId,
  conversationId,
  groupName,
}: GroupChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [members, setMembers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [showGroupInfo, setShowGroupInfo] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadMessages()
    loadMembers()
    const cleanup = setupRealtime()
    
    return () => {
      if (cleanup) cleanup()
    }
  }, [conversationId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*, sender:users!messages_sender_id_fkey(*)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error loading messages:', error)
      return
    }

    setMessages(data || [])
    setLoading(false)
  }

  const loadMembers = async () => {
    const { data } = await supabase
      .from('conversation_participants')
      .select('user:users!conversation_participants_user_id_fkey(*)')
      .eq('conversation_id', conversationId)

    if (data) {
      setMembers(data.map((p: any) => p.user).filter(Boolean))
    }
  }

  const setupRealtime = () => {
    const channel = supabase
      .channel(`group:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          loadMessages()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleNewMessage = async (content: string, imageUrl?: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUserId,
          conversation_id: conversationId,
          content: content || '',
          image_url: imageUrl,
          status: 'sent',
        })

      if (error) {
        console.error('Error sending message:', error)
        throw new Error('Failed to send message. Please try again.')
      }

      loadMessages()
    } catch (error: any) {
      console.error('Error in handleNewMessage:', error)
      throw error
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-400">Loading messages...</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="font-semibold text-lg flex items-center gap-2">
              {groupName}
              <button
                onClick={() => setShowGroupInfo(!showGroupInfo)}
                className="text-sm text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100"
                title="View group info"
              >
                ℹ️
              </button>
            </div>
            <div className="text-xs text-gray-500">
              {members.length} members
            </div>
          </div>
          <div className="flex items-center -space-x-2">
            {members.slice(0, 3).map((member) => (
              <div key={member.id} className="border-2 border-white rounded-full" title={getUserDisplayName(member)}>
                <UserAvatar user={member} size="sm" />
              </div>
            ))}
            {members.length > 3 && (
              <div className="w-8 h-8 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs font-semibold border-2 border-white">
                +{members.length - 3}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Group Info Panel */}
      {showGroupInfo && (
        <div className="bg-gray-50 border-b border-gray-200 p-4 max-h-48 overflow-y-auto">
          <h3 className="font-semibold mb-3">Group Members ({members.length})</h3>
          <div className="space-y-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 p-2 bg-white rounded-lg">
                <UserAvatar user={member} size="sm" />
                <div>
                  <div className="text-sm font-medium">{getUserDisplayName(member)}</div>
                  <div className="text-xs text-gray-500">@{member.username || member.email?.split('@')[0]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-2 bg-gray-50">
        {messages.map((message, index) => {
          const isOwn = message.sender_id === currentUserId
          const showDate =
            index === 0 ||
            new Date(message.created_at).toDateString() !==
              new Date(messages[index - 1].created_at).toDateString()
          const showSender =
            !isOwn &&
            (index === 0 || messages[index - 1].sender_id !== message.sender_id)

          return (
            <div key={message.id}>
              {showDate && (
                <div className="text-center text-xs text-gray-500 my-4">
                  {format(new Date(message.created_at), 'MMMM d, yyyy')}
                </div>
              )}
              <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md ${isOwn ? '' : 'flex flex-col'}`}>
                  {showSender && (
                    <div className="text-xs text-gray-600 mb-1 px-2">
                      {getUserDisplayName(message.sender)}
                    </div>
                  )}
                  <div
                    className={`px-4 py-2 rounded-lg ${
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
                    {getMessageContent(message) && (
                      <div className="whitespace-pre-wrap">{getMessageContent(message)}</div>
                    )}
                    <div
                      className={`text-xs mt-1 ${
                        isOwn ? 'text-primary-100' : 'text-gray-500'
                      }`}
                    >
                      {format(new Date(message.created_at), 'HH:mm')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      <TypingIndicator
        conversationId={conversationId}
        currentUserId={currentUserId}
      />

      {/* Message Input */}
      <MessageInput 
        draftKey={`draft:group:${conversationId}`}
        onSendMessage={handleNewMessage}
        onTyping={(typing) => {
          // Broadcast typing status to group
          const channel = supabase.channel(`typing:conversation:${conversationId}`)
          
          if (typing) {
            channel.send({
              type: 'broadcast',
              event: 'typing',
              payload: { 
                userId: currentUserId, 
                userName: 'Someone'
              },
            })
          }
        }}
      />

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

