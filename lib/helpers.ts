import { User, Message } from './supabase'

// Helper to get user display name
export function getUserDisplayName(user: User | null | undefined): string {
  if (!user) return 'Unknown'
  return user.name || user.full_name || user.username || user.email.split('@')[0]
}

// Helper to get user avatar URL
export function getUserAvatarUrl(user: User | null | undefined): string | undefined {
  if (!user) return undefined
  return user.avatar_url || user.profile_picture
}

// Helper to get message content
export function getMessageContent(message: Message): string {
  return message.content || message.message_text || ''
}

// Helper to check if message has image
export function hasMessageImage(message: Message): boolean {
  return !!(message.image_url || (message.message_type === 'image'))
}

