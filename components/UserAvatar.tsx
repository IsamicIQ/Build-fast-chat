'use client'

import { getUserDisplayName } from '@/lib/helpers'

interface UserAvatarProps {
  user: any
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export default function UserAvatar({ user, size = 'md', className = '' }: UserAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-20 h-20 text-3xl'
  }

  if (user?.profile_picture) {
    return (
      <img
        src={user.profile_picture}
        alt={getUserDisplayName(user)}
        className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
      />
    )
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-primary-500 text-white flex items-center justify-center font-semibold ${className}`}>
      {getUserDisplayName(user).charAt(0).toUpperCase()}
    </div>
  )
}

