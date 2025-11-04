'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getUserDisplayName } from '@/lib/helpers'

interface TypingIndicatorProps {
  conversationId?: string
  otherUserId?: string
  currentUserId: string
}

export default function TypingIndicator({
  conversationId,
  otherUserId,
  currentUserId,
}: TypingIndicatorProps) {
  const [typingUsers, setTypingUsers] = useState<any[]>([])

  useEffect(() => {
    const channelName = conversationId 
      ? `typing:conversation:${conversationId}`
      : `typing:direct:${currentUserId}:${otherUserId}`

    const channel = supabase.channel(channelName)
    
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== currentUserId) {
          setTypingUsers([payload])
          // Clear after 3 seconds
          setTimeout(() => setTypingUsers([]), 3000)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, otherUserId, currentUserId])

  if (typingUsers.length === 0) return null

  return (
    <div className="px-4 py-2 text-sm text-gray-500 italic bg-gray-50">
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </div>
        <span>
          {typingUsers.length === 1
            ? `${typingUsers[0].userName || 'Someone'} is typing...`
            : `${typingUsers.length} people are typing...`}
        </span>
      </div>
    </div>
  )
}

