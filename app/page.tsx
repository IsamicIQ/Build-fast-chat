'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import ChatList from '@/components/ChatList'
import ChatWindow from '@/components/ChatWindow'
import GroupChatWindow from '@/components/GroupChatWindow'
import UserSearch from '@/components/UserSearch'
import ProfileModal from '@/components/ProfileModal'
import BlockedUsersPage from '@/components/BlockedUsersPage'
import CreateGroupChat from '@/components/CreateGroupChat'
import UserAvatar from '@/components/UserAvatar'
import { getUserDisplayName } from '@/lib/helpers'

export default function Home() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [showBlockedUsers, setShowBlockedUsers] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const router = useRouter()

  useEffect(() => {
    checkUser()
    
    const unsubscribe = setupAuthListener()
    
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const checkUser = async () => {
    try {
      console.log('Checking user...')
      // First check session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      console.log('Session:', session ? 'Found' : 'Not found', 'Error:', sessionError)
      
      if (!session || sessionError) {
        console.log('No session, redirecting to auth')
        setLoading(false)
        router.push('/auth')
        return
      }

      // Get user from session
      const authUser = session.user
      if (!authUser) {
        console.log('No auth user, redirecting to auth')
        router.push('/auth')
        return
      }

      // Get or create user profile (align fields with DB schema)
      let { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()

      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        console.log('Creating new user profile')
        const { data: newProfile, error: insertError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email || '',
            name: (authUser.email || '').split('@')[0],
          })
          .select()
          .single()

        if (insertError) {
          console.error('Error creating profile:', insertError)
          // Try to continue anyway with auth user data
          profile = {
            id: authUser.id,
            email: authUser.email || '',
            name: (authUser.email || '').split('@')[0],
            created_at: new Date().toISOString(),
          } as any
        } else {
          profile = newProfile
        }
      } else if (profileError) {
        console.error('Error fetching profile:', profileError)
        router.push('/auth')
        return
      }

      if (profile) {
        console.log('User profile loaded:', profile.email)
        
        // Profile exists and is minimal; no setup redirect needed
        
        setUser(profile)
      } else {
        console.error('No profile available')
        setLoading(false)
        router.push('/auth')
        return
      }
    } catch (error) {
      console.error('Error in checkUser:', error)
      setLoading(false)
      router.push('/auth')
      return
    } finally {
      console.log('Setting loading to false')
      setLoading(false)
    }
  }

  const setupAuthListener = () => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/auth')
      }
      // Don't redirect on other events to prevent refresh loops
    })
    
    return () => subscription.unsubscribe()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="text-xl mb-2">Loading...</div>
          <div className="text-sm text-gray-500">Please wait</div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="text-xl mb-2">No user found</div>
          <button
            onClick={() => router.push('/auth')}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  if (showBlockedUsers) {
    if (!user) {
      return (
        <div className="flex items-center justify-center h-screen">
          <div className="text-xl">Loading...</div>
        </div>
      )
    }
    return (
      <BlockedUsersPage
        currentUserId={user.id}
        onBack={() => setShowBlockedUsers(false)}
      />
    )
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {user && (
            <>
              <div className="flex items-center gap-3">
                <UserAvatar user={user} size="md" />
                <div>
                  <div className="font-semibold">{getUserDisplayName(user)}</div>
                  <div className="text-xs text-gray-500">{user?.email || ''}</div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Logout
              </button>
            </>
          )}
        </div>

        {/* Search Bar & New Group */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setShowSearch(true)}
              className="flex-1 px-4 py-2 bg-gray-100 rounded-lg text-left text-sm text-gray-600 hover:bg-gray-200 transition-colors"
              title="Search for users, messages, and conversations"
            >
              🔍 Search users & messages
            </button>
          </div>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            + Create Group Chat
          </button>
        </div>

        {/* Chat List */}
        {user && (
          <ChatList
            currentUserId={user.id}
            onSelectUser={(userId) => {
              setSelectedUserId(userId)
              setSelectedConversationId(null)
              setSelectedGroupName(null)
            }}
            onSelectGroup={(conversationId, groupName) => {
              setSelectedConversationId(conversationId)
              setSelectedGroupName(groupName)
              setSelectedUserId(null)
            }}
            selectedUserId={selectedUserId}
            selectedConversationId={selectedConversationId}
            onOpenProfile={(userId) => {
              setProfileUserId(userId)
              setShowProfile(true)
            }}
          />
        )}

        {/* Bottom Menu */}
        <div className="mt-auto p-4 border-t border-gray-200 space-y-2">
          <button
            onClick={() => router.push('/settings')}
            className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2"
          >
            ⚙️ Settings
          </button>
          <button
            onClick={() => setShowBlockedUsers(true)}
            className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2"
          >
            🚫 Blocked Users
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {user && selectedConversationId && selectedGroupName ? (
          <GroupChatWindow
            currentUserId={user.id}
            conversationId={selectedConversationId}
            groupName={selectedGroupName}
          />
        ) : user && selectedUserId ? (
          <ChatWindow
            currentUserId={user.id}
            otherUserId={selectedUserId}
            onOpenProfile={(userId) => {
              setProfileUserId(userId)
              setShowProfile(true)
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select a conversation to start chatting
          </div>
        )}
      </div>

      {/* Modals */}
      {showSearch && user && (
        <UserSearch
          currentUserId={user.id}
          onClose={() => setShowSearch(false)}
          onSelectUser={(userId) => {
            setSelectedUserId(userId)
            setShowSearch(false)
          }}
        />
      )}

      {showProfile && profileUserId && user && (
        <ProfileModal
          currentUserId={user.id}
          profileUserId={profileUserId}
          onClose={() => {
            setShowProfile(false)
            setProfileUserId(null)
          }}
          onBlock={() => {
            setShowProfile(false)
            setProfileUserId(null)
          }}
        />
      )}

      {showCreateGroup && user && (
        <CreateGroupChat
          currentUserId={user.id}
          onClose={() => setShowCreateGroup(false)}
          onGroupCreated={(groupId, groupName) => {
            setShowCreateGroup(false)
            setSelectedConversationId(groupId)
            setSelectedGroupName(groupName)
            setSelectedUserId(null)
            // Trigger refresh of chat list
            setTimeout(() => {
              window.location.reload()
            }, 100)
          }}
        />
      )}
    </div>
  )
}

