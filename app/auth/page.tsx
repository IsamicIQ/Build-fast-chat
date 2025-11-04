'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => {
    checkSession()
  }, [])

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      router.push('/')
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isSignUp) {
        // Ensure email has proper format for Supabase (add @test.com if needed)
        let formattedEmail = email
        if (!email.includes('@')) {
          formattedEmail = `${email}@test.com`
        }
        
        // Sign up user with email confirmation disabled
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: formattedEmail,
          password,
          options: {
            emailRedirectTo: undefined,
            data: {
              username: email.includes('@') ? email.split('@')[0] : email,
            }
          }
        })

        if (signUpError) {
          console.error('Signup error:', signUpError)
          throw signUpError
        }

        // Account created successfully!
        if (data.user) {
          console.log('✅ User created:', data.user.id)
          
          // Create basic user profile
          const { error: profileError } = await supabase.from('users').insert({
            id: data.user.id,
            email: formattedEmail,
            username: email.includes('@') ? email.split('@')[0] : email,
            name: email.includes('@') ? email.split('@')[0] : email,
          })

          if (profileError) {
            console.log('Profile insert error (might already exist):', profileError.message)
          }

          // If we have a session, great! If not, try to sign in
          if (!data.session) {
            console.log('No session yet, attempting sign in...')
            
            // Try to sign in (will work if email confirmation is disabled)
            const { data: signInData } = await supabase.auth.signInWithPassword({
              email: formattedEmail,
              password,
            })

            if (signInData?.session) {
              console.log('✅ Signed in successfully!')
            } else {
              console.log('⚠️ No session, but continuing to profile setup')
            }
          }

          // Always redirect to profile setup, regardless of session status
          console.log('Redirecting to profile setup...')
          window.location.href = '/setup-profile'
        }
      } else {
        // Ensure email has proper format for Supabase (add @test.com if needed)
        let formattedEmail = email
        if (!email.includes('@')) {
          formattedEmail = `${email}@test.com`
        }
        
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formattedEmail,
          password,
        })

        if (signInError) throw signInError

        window.location.href = '/'
      }
    } catch (err: any) {
      console.error('Auth error:', err)
      // Don't show confusing technical errors
      if (isSignUp) {
        setError('Failed to create account. Try a different username/email.')
      } else {
        setError('Invalid username or password. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h1>

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Email (or username)</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="any@email.com or just 'user1'"
            />
            <p className="text-xs text-gray-500 mt-1">You can use any format - no verification needed!</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError('')
            }}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  )
}

