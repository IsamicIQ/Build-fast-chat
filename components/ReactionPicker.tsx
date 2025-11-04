'use client'

import React from 'react'

interface ReactionPickerProps {
  onSelect: (emoji: string) => void
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

export default function ReactionPicker({ onSelect }: ReactionPickerProps) {
  return (
    <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-lg shadow-sm">
      {EMOJIS.map((e) => (
        <button
          key={e}
          onClick={() => onSelect(e)}
          className="px-2 py-1 hover:bg-gray-100 rounded text-lg"
          title={`React with ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  )
}


