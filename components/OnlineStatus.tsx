'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface OnlineStatusProps {
  userId: string
}

export default function OnlineStatus({ userId }: OnlineStatusProps) {
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    checkOnlineStatus()
    
    // Set up presence channel
    const channel = supabase.channel(`presence:${userId}`)
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setIsOnline(Object.keys(state).length > 0)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const checkOnlineStatus = async () => {
    // In a real app, you'd check presence or last_seen timestamp
    // For now, just show as potentially online
    setIsOnline(false)
  }

  return (
    <div 
      className={`w-3 h-3 rounded-full border-2 border-white ${
        isOnline ? 'bg-green-500' : 'bg-gray-400'
      }`}
      title={isOnline ? 'Online' : 'Offline'}
    />
  )
}

