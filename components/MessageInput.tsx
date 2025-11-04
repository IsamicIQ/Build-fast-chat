'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface MessageInputProps {
  onSendMessage: (content: string, imageUrl?: string) => void
  onTyping?: (isTyping: boolean) => void
  draftKey?: string
}

export default function MessageInput({ onSendMessage, onTyping, draftKey }: MessageInputProps) {
  const [content, setContent] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load saved draft
  useEffect(() => {
    if (draftKey && typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(draftKey)
      if (saved) setContent(saved)
    }
  }, [draftKey])

  // Persist draft on change
  useEffect(() => {
    if (!draftKey || typeof window === 'undefined') return
    if (content) window.localStorage.setItem(draftKey, content)
    else window.localStorage.removeItem(draftKey)
  }, [content, draftKey])

  const handleSend = async () => {
    if (!content.trim() && !imagePreview) return

    let imageUrl: string | undefined

    // Upload image if there's a preview
    if (imagePreview) {
      setUploading(true)
      try {
        // Create a file from the preview URL
        const response = await fetch(imagePreview)
        const blob = await response.blob()
        const file = new File([blob], 'image.jpg', { type: blob.type })

        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        const filePath = `messages/${fileName}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('messages')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          throw new Error(uploadError.message || 'Failed to upload image')
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('messages').getPublicUrl(filePath)

        imageUrl = publicUrl
      } catch (error: any) {
        console.error('Error uploading image:', error)
        alert(error.message || 'Failed to upload image. Please try again.')
        setUploading(false)
        return
      }
    }

    try {
      await onSendMessage(content, imageUrl)
      setContent('')
      setImagePreview(null)
      setUploading(false)
      if (draftKey && typeof window !== 'undefined') {
        window.localStorage.removeItem(draftKey)
      }
    } catch (error: any) {
      console.error('Error sending message:', error)
      alert(error.message || 'Failed to send message. Please try again.')
      setUploading(false)
    }
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size (2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image must be smaller than 2MB')
      return
    }

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="p-4 bg-white border-t border-gray-200">
      {/* Image Preview */}
      {imagePreview && (
        <div className="mb-2 relative">
          <img
            src={imagePreview}
            alt="Preview"
            className="max-w-xs h-32 object-cover rounded-lg"
          />
          <button
            onClick={() => setImagePreview(null)}
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg flex-shrink-0"
          title="Upload image"
        >
          📸
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            
            // Trigger typing indicator
            if (onTyping) {
              onTyping(true)
              
              // Clear previous timeout
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
              }
              
              // Stop typing after 2 seconds of no input
              typingTimeoutRef.current = setTimeout(() => {
                onTyping(false)
              }, 2000)
            }
          }}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          rows={1}
        />

        <button
          onClick={handleSend}
          disabled={(!content.trim() && !imagePreview) || uploading}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {uploading ? 'Uploading...' : 'Send'}
        </button>
      </div>
    </div>
  )
}

