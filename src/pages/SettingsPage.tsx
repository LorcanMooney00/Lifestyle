import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getPartnerId, linkPartner, unlinkPartner } from '../lib/api'
import { signOut } from '../lib/auth'

export default function SettingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [partnerEmail, setPartnerEmail] = useState('')
  const [linkedPartnerId, setLinkedPartnerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadPartnerStatus()
    }
  }, [user])

  const loadPartnerStatus = async () => {
    if (!user) return
    setLoading(true)
    const partnerId = await getPartnerId(user.id)
    setLinkedPartnerId(partnerId)
    setLoading(false)
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

  const handleUnlinkPartner = async () => {
    if (!user) return
    
    if (!confirm('Are you sure you want to unlink from your partner? You will no longer be able to see each other\'s notes.')) {
      return
    }

    setUnlinking(true)
    setError(null)
    setSuccess(null)

    const success = await unlinkPartner(user.id)
    if (success) {
      setSuccess('Partner unlinked successfully.')
      setLinkedPartnerId(null)
    } else {
      setError('Failed to unlink partner. Please try again.')
    }

    setUnlinking(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/app/topics')}
                className="text-gray-600 hover:text-gray-900 mr-4"
              >
                ← Dashboard
              </button>
              <h1 className="text-xl font-bold text-gray-900">Settings</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleSignOut}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-sm rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Partner Linking
          </h2>

          {loading ? (
            <div className="text-gray-600">Loading...</div>
          ) : linkedPartnerId ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                <p className="font-medium">Partner Linked</p>
                <p className="text-sm mt-1">
                  Your account is linked with your partner. You can now share topics and notes together.
                </p>
              </div>
              <p className="text-sm text-gray-600">
                Partner ID: {linkedPartnerId}
              </p>
              <button
                onClick={handleUnlinkPartner}
                disabled={unlinking}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {unlinking ? 'Unlinking...' : 'Unlink Partner'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600">
                Link your account with your partner's account to share topics and notes together.
                Your partner needs to have an account with the email address you provide.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                  {success}
                </div>
              )}

              <form onSubmit={handleLinkPartner} className="space-y-4">
                <div>
                  <label
                    htmlFor="partner-email"
                    className="block text-sm font-medium text-gray-700 mb-2"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={linking || !partnerEmail.trim()}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {linking ? 'Linking...' : 'Link Partner'}
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="bg-white shadow-sm rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Account Information
          </h2>
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Email:</span> {user?.email}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">User ID:</span> {user?.id}
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

