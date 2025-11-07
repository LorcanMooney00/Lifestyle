import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getPartners, linkPartner, unlinkPartner, getUserProfile, updateUserProfile } from '../lib/api'
import { signOut } from '../lib/auth'

export default function SettingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [partnerEmail, setPartnerEmail] = useState('')
  const [partners, setPartners] = useState<Array<{ id: string; email: string; username: string }>>([])
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Username state
  const [username, setUsername] = useState('')
  const [usernameLoading, setUsernameLoading] = useState(false)
  const [usernameEditing, setUsernameEditing] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadPartnerStatus()
      loadUsername()
    }
  }, [user])

  const loadUsername = async () => {
    if (!user) return
    const { username: currentUsername } = await getUserProfile(user.id)
    setUsername(currentUsername || '')
  }

  const loadPartnerStatus = async () => {
    if (!user) return
    setLoading(true)
    const data = await getPartners(user.id)
    setPartners(data)
    setLoading(false)
  }

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !username.trim()) {
      setUsernameError('Username cannot be empty')
      return
    }

    setUsernameLoading(true)
    setUsernameError(null)
    setUsernameSuccess(null)

    const { success, error } = await updateUserProfile(user.id, username.trim())
    
    if (success) {
      setUsernameSuccess('Username updated successfully!')
      setUsernameEditing(false)
      // Reload partners to show updated username
      await loadPartnerStatus()
    } else {
      setUsernameError(error || 'Failed to update username')
    }

    setUsernameLoading(false)
  }

  const handleLinkPartner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !partnerEmail.trim()) return

    setLinking(true)
    setError(null)
    setSuccess(null)

    const success = await linkPartner(user.id, partnerEmail.trim())
    if (success) {
      setSuccess('Partner linked successfully!')
      setPartnerEmail('')
      await loadPartnerStatus()
    } else {
      setError('Failed to link partner. Make sure they have an account with this email.')
    }

    setLinking(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/app/topics')}
                className="text-gray-300 hover:text-gray-100 mr-4"
              >
                ← Dashboard
              </button>
              <h1 className="text-xl font-bold text-gray-100">Settings</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleSignOut}
                className="text-gray-300 hover:text-gray-100 px-3 py-2 rounded-md text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gray-800 shadow-sm rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-gray-100 mb-6">
            Partner Linking
          </h2>

          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-6">
              {/* Show existing partners if any */}
              {partners.length > 0 && (
                <div className="space-y-4">
                  <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded">
                    <p className="font-medium">Linked Partners</p>
                    <p className="text-sm mt-1">
                      You have {partners.length} partner{partners.length !== 1 ? 's' : ''} linked.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {partners.map((partner) => (
                      <div
                        key={partner.id}
                        className="flex items-center justify-between bg-gray-700 p-3 rounded border border-gray-600"
                      >
                        <div>
                          <p className="font-medium text-gray-100">{partner.username}</p>
                          <p className="text-sm text-gray-400">{partner.email}</p>
                        </div>
                        <button
                          onClick={async () => {
                            if (!user) return
                            if (confirm(`Are you sure you want to unlink from ${partner.email}?`)) {
                              setUnlinking(true)
                              const success = await unlinkPartner(user.id, partner.id)
                              if (success) {
                                setSuccess('Partner unlinked successfully.')
                                await loadPartnerStatus()
                              } else {
                                setError('Failed to unlink partner. Please try again.')
                              }
                              setUnlinking(false)
                            }
                          }}
                          disabled={unlinking || !user}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-500 disabled:opacity-50"
                        >
                          Unlink
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Always show the form to add more partners */}
              <div className="space-y-4 border-t border-gray-700 pt-6">
                <h3 className="text-lg font-semibold text-gray-100">
                  {partners.length > 0 ? 'Add Another Partner' : 'Link a Partner'}
                </h3>
                <p className="text-gray-400 text-sm">
                  Link your account with a partner's account to share notes and calendar events together.
                  Your partner needs to have an account with the email address you provide.
                </p>

                {error && (
                  <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                {success && (
                  <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded">
                    {success}
                  </div>
                )}

                <form onSubmit={handleLinkPartner} className="space-y-4">
                  <div>
                    <label
                      htmlFor="partner-email"
                      className="block text-sm font-medium text-gray-300 mb-2"
                    >
                      Partner's Email Address
                    </label>
                    <input
                      id="partner-email"
                      type="email"
                      value={partnerEmail}
                      onChange={(e) => setPartnerEmail(e.target.value)}
                      placeholder="partner@example.com"
                      required
                      className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={linking || !partnerEmail.trim()}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {linking ? 'Linking...' : 'Link Partner'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-800 shadow-sm rounded-lg p-6 mt-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">
            Username
          </h2>
          
          {usernameEditing ? (
            <form onSubmit={handleUpdateUsername} className="space-y-4">
              {usernameError && (
                <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
                  {usernameError}
                </div>
              )}
              
              {usernameSuccess && (
                <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded">
                  {usernameSuccess}
                </div>
              )}
              
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={usernameLoading}
                />
              </div>
              
              <div className="flex space-x-2">
                <button
                  type="submit"
                  disabled={usernameLoading || !username.trim()}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {usernameLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUsernameEditing(false)
                    setUsernameError(null)
                    setUsernameSuccess(null)
                    loadUsername()
                  }}
                  disabled={usernameLoading}
                  className="bg-gray-700 text-gray-300 px-4 py-2 rounded-md hover:bg-gray-600 disabled:opacity-50 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">
                    <span className="font-medium">Username:</span>{' '}
                    {username || (
                      <span className="text-gray-500 italic">Not set</span>
                    )}
                  </p>
                  {!username && (
                    <p className="text-xs text-gray-500 mt-1">
                      Set a username so partners can easily identify you
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setUsernameEditing(true)
                    setUsernameError(null)
                    setUsernameSuccess(null)
                  }}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm font-medium"
                >
                  {username ? 'Change' : 'Add'} Username
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-800 shadow-sm rounded-lg p-6 mt-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">
            Account Information
          </h2>
          <div className="space-y-2">
            <p className="text-sm text-gray-400">
              <span className="font-medium">Email:</span> {user?.email}
            </p>
            <p className="text-sm text-gray-400">
              <span className="font-medium">User ID:</span> {user?.id}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

