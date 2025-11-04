'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SetupProfile() {
  const [user, setUser] = useState<any>(null)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    // Try multiple times to get session (in case it takes a moment)
    let session = null
    for (let i = 0; i < 5; i++) {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (currentSession) {
        session = currentSession
        break
      }
      console.log(`Attempt ${i + 1}: No session yet, waiting...`)
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    if (!session) {
      console.log('No session after 5 attempts, redirecting to auth')
      router.push('/auth')
      return
    }

    console.log('✅ Session found:', session.user.id)

    // Check if profile already exists
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (profile && profile.username && profile.name) {
      // Profile already set up, redirect to home
      console.log('Profile already complete, redirecting to home')
      router.push('/')
      return
    }

    setUser(session.user)
    // Pre-fill with email-based username
    setUsername(session.user.email?.split('@')[0] || '')
    setFullName(session.user.email?.split('@')[0] || '')
    setLoading(false)
  }

  const handleSave = async () => {
    if (!fullName.trim() || !username.trim()) {
      setError('Please fill in all required fields')
      return
    }

    // Validate username (alphanumeric and underscores only)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username can only contain letters, numbers, and underscores')
      return
    }

    setSaving(true)
    setError('')

    try {
      // Check if username is already taken
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .neq('id', user.id)
        .single()

      if (existingUser) {
        setError('Username already taken. Please choose another.')
        setSaving(false)
        return
      }

      // Update profile
      const { error: updateError } = await supabase
        .from('users')
        .update({
          username: username.trim(),
          name: fullName.trim(),
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      // Redirect to home
      window.location.href = '/'
    } catch (err: any) {
      setError(err.message || 'Failed to update profile')
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    // Set minimal defaults and proceed
    if (!user) return
    
    setSaving(true)
    try {
      const defaultUsername = user.email?.split('@')[0] || 'user'
      const defaultName = user.email?.split('@')[0] || 'User'
      
      await supabase
        .from('users')
        .update({
          username: defaultUsername,
          name: defaultName,
        })
        .eq('id', user.id)
      
      window.location.href = '/'
    } catch (error) {
      console.error('Error skipping profile setup:', error)
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">👤</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Set Up Your Profile</h1>
          <p className="text-gray-600 text-sm">
            Tell us a bit about yourself to get started
          </p>
        </div>

        <div className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              maxLength={50}
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="johndoe"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              maxLength={30}
            />
            <p className="text-xs text-gray-500 mt-1">
              Letters, numbers, and underscores only
            </p>
          </div>

          {/* Bio (Optional) */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Bio <span className="text-gray-400 text-xs">(Optional)</span>
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about yourself..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              rows={3}
              maxLength={150}
            />
            <p className="text-xs text-gray-500 mt-1 text-right">
              {bio.length}/150
            </p>
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !fullName.trim() || !username.trim()}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Complete Setup'}
            </button>
            
            <button
              onClick={handleSkip}
              disabled={saving}
              className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors text-sm"
            >
              Skip for now
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-500 text-center mt-6">
          You can always change this later in your settings
        </p>
      </div>
    </div>
  )
}

