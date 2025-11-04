'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DebugPage() {
  const [info, setInfo] = useState<any>({})

  useEffect(() => {
    checkEverything()
  }, [])

  const checkEverything = async () => {
    const results: any = {}

    // Check session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    results.session = sessionData.session ? 'Active' : 'None'
    results.sessionError = sessionError?.message || 'None'

    if (sessionData.session) {
      results.userId = sessionData.session.user.id
      results.userEmail = sessionData.session.user.email

      // Check profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', sessionData.session.user.id)
        .single()

      results.profile = profile ? 'Found' : 'Not found'
      results.profileError = profileError?.message || 'None'
      results.profileData = profile
    }

    // Check Supabase connection
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('count')
      .limit(1)

    results.supabaseConnection = testError ? 'Failed' : 'Connected'
    results.connectionError = testError?.message || 'None'

    setInfo(results)
  }

  const handleClearSession = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Debug Information</h1>
        
        <div className="space-y-4">
          <div>
            <strong>Session:</strong> {info.session || 'Checking...'}
          </div>
          <div>
            <strong>Session Error:</strong> {info.sessionError || 'Checking...'}
          </div>
          {info.userId && (
            <>
              <div>
                <strong>User ID:</strong> {info.userId}
              </div>
              <div>
                <strong>Email:</strong> {info.userEmail}
              </div>
              <div>
                <strong>Profile:</strong> {info.profile}
              </div>
              <div>
                <strong>Profile Error:</strong> {info.profileError}
              </div>
            </>
          )}
          <div>
            <strong>Supabase Connection:</strong> {info.supabaseConnection || 'Checking...'}
          </div>
          <div>
            <strong>Connection Error:</strong> {info.connectionError || 'Checking...'}
          </div>

          {info.profileData && (
            <div>
              <strong>Profile Data:</strong>
              <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                {JSON.stringify(info.profileData, null, 2)}
              </pre>
            </div>
          )}
        </div>

        <div className="mt-6 space-x-4">
          <button
            onClick={handleClearSession}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Clear Session & Go to Login
          </button>
          <button
            onClick={checkEverything}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Go to Home
          </a>
        </div>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm">
            <strong>If you see errors:</strong>
            <br />1. Check that email confirmation is DISABLED in Supabase Dashboard
            <br />2. Run the SQL migration in Supabase SQL Editor
            <br />3. Try clearing session and logging in again
          </p>
        </div>
      </div>
    </div>
  )
}

