'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getUserDisplayName } from '@/lib/helpers'

export default function Settings() {
  const [user, setUser] = useState<any>(null)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [profilePicture, setProfilePicture] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingEmail, setChangingEmail] = useState(false)
  const [showEmailChange, setShowEmailChange] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      router.push('/auth')
      return
    }

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (profile) {
      setUser(profile)
      setFullName(profile.full_name || '')
      setUsername(profile.username || '')
      setEmail(profile.email || '')
      setProfilePicture(profile.profile_picture || null)
    }
    
    setLoading(false)
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB')
      return
    }

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    setUploadingImage(true)
    setError('')

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `profile-pictures/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('messages')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('messages').getPublicUrl(filePath)

      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_picture: publicUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      setProfilePicture(publicUrl)
      setSuccess('Profile picture updated!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to upload image')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleEmailChange = async () => {
    if (!newEmail.trim() || newEmail === email) {
      setError('Please enter a different email')
      return
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setError('Please enter a valid email address')
      return
    }

    setChangingEmail(true)
    setError('')

    try {
      // Update auth email
      const { error: authError } = await supabase.auth.updateUser({
        email: newEmail,
      })

      if (authError) throw authError

      // Update users table
      const { error: updateError } = await supabase
        .from('users')
        .update({ email: newEmail })
        .eq('id', user.id)

      if (updateError) throw updateError

      setSuccess('Email update link sent! Check your new email to confirm.')
      setEmail(newEmail)
      setNewEmail('')
      setShowEmailChange(false)
      setTimeout(() => setSuccess(''), 5000)
    } catch (err: any) {
      setError(err.message || 'Failed to update email')
    } finally {
      setChangingEmail(false)
    }
  }

  const handleSave = async () => {
    if (!fullName.trim() || !username.trim()) {
      setError('Please fill in all required fields')
      return
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username can only contain letters, numbers, and underscores')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      // Check if username is already taken by someone else
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
          full_name: fullName.trim(),
          username: username.trim(),
          name: fullName.trim(),
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      setSuccess('Profile updated successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update profile')
    } finally {
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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            ← Back to Chat
          </button>
          <h1 className="text-xl font-bold">Settings</h1>
          <div className="w-24"></div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          {/* Profile Section */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
            
            {/* Avatar */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                {profilePicture ? (
                  <img
                    src={profilePicture}
                    alt={getUserDisplayName(user)}
                    className="w-20 h-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary-500 text-white flex items-center justify-center text-3xl font-bold">
                    {getUserDisplayName(user).charAt(0).toUpperCase()}
                  </div>
                )}
                <label
                  htmlFor="profile-picture"
                  className="absolute bottom-0 right-0 w-8 h-8 bg-primary-600 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-primary-700 shadow-lg"
                  title="Change profile picture"
                >
                  📷
                </label>
                <input
                  id="profile-picture"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploadingImage}
                />
              </div>
              <div className="flex-1">
                <div className="font-medium">{getUserDisplayName(user)}</div>
                <div className="text-sm text-gray-500">@{username}</div>
                {uploadingImage && (
                  <div className="text-xs text-primary-600 mt-1">Uploading...</div>
                )}
              </div>
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  maxLength={30}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Letters, numbers, and underscores only
                </p>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                  <button
                    onClick={() => setShowEmailChange(!showEmailChange)}
                    className="px-3 py-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Change
                  </button>
                </div>
                {showEmailChange && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Enter new email address"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-2"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleEmailChange}
                        disabled={changingEmail}
                        className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                      >
                        {changingEmail ? 'Updating...' : 'Update Email'}
                      </button>
                      <button
                        onClick={() => {
                          setShowEmailChange(false)
                          setNewEmail('')
                        }}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      You'll need to confirm your new email address
                    </p>
                  </div>
                )}
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                  {error}
                </div>
              )}

              {success && (
                <div className="text-green-600 text-sm bg-green-50 p-3 rounded">
                  {success}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Account Actions */}
          <div className="bg-white rounded-lg shadow p-6 mt-4">
            <h2 className="text-lg font-semibold mb-4">Account</h2>
            <button
              onClick={async () => {
                if (confirm('Are you sure you want to log out?')) {
                  await supabase.auth.signOut()
                  router.push('/auth')
                }
              }}
              className="w-full bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

