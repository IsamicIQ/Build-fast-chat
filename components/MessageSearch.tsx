'use client'

import { useState, useMemo } from 'react'
import { Message } from '@/lib/supabase'
import { format } from 'date-fns'
import { getMessageContent, hasMessageImage } from '@/lib/helpers'

interface MessageSearchProps {
  messages: Message[]
  onClose: () => void
  onSelectMessage: (messageId: string) => void
}

export default function MessageSearch({
  messages,
  onClose,
  onSelectMessage,
}: MessageSearchProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const results = useMemo(() => {
    if (!query.trim()) return []
    const lowerQuery = query.toLowerCase()
    return messages.filter(
      (msg) => {
        const content = getMessageContent(msg).toLowerCase()
        return content.includes(lowerQuery) ||
          (hasMessageImage(msg) && 'image'.includes(lowerQuery))
      }
    )
  }, [query, messages])

  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(messageId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Highlight the message briefly
      element.style.backgroundColor = 'rgba(59, 130, 246, 0.2)'
      setTimeout(() => {
        element.style.backgroundColor = ''
      }, 2000)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown' && selectedIndex < results.length - 1) {
      e.preventDefault()
      setSelectedIndex(selectedIndex + 1)
      scrollToMessage(results[selectedIndex + 1].id)
    } else if (e.key === 'ArrowUp' && selectedIndex > 0) {
      e.preventDefault()
      setSelectedIndex(selectedIndex - 1)
      scrollToMessage(results[selectedIndex - 1].id)
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault()
      const messageId = results[selectedIndex].id
      scrollToMessage(messageId)
      onSelectMessage(messageId)
    }
  }

  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text
    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 z-40 flex items-start justify-center pt-20">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedIndex(0)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search messages..."
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
          {query && (
            <div className="mt-2 text-sm text-gray-500">
              {results.length > 0
                ? `${selectedIndex + 1} of ${results.length} results`
                : 'No results found'}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 && query ? (
            <div className="p-8 text-center text-gray-400">
              No messages found
            </div>
          ) : (
            results.map((message, index) => (
              <div
                key={message.id}
                onClick={() => {
                  scrollToMessage(message.id)
                  onSelectMessage(message.id)
                }}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  index === selectedIndex ? 'bg-blue-50' : ''
                }`}
              >
                <div className="text-sm text-gray-500 mb-1">
                  {format(new Date(message.created_at), 'MMM d, yyyy HH:mm')}
                </div>
                {hasMessageImage(message) && (
                  <div className="mb-2">
                    <img
                      src={message.image_url || ''}
                      alt=""
                      className="max-w-xs h-24 object-cover rounded"
                    />
                  </div>
                )}
                {getMessageContent(message) && (
                  <div className="text-gray-900">
                    {highlightText(getMessageContent(message), query)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Navigation Hints */}
        {results.length > 0 && (
          <div className="p-3 border-t border-gray-200 text-xs text-gray-500 text-center">
            Use ↑ ↓ to navigate, Enter to jump to message, Esc to close
          </div>
        )}
      </div>
    </div>
  )
}

