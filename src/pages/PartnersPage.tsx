import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getPartners } from '../lib/api'
import { signOut } from '../lib/auth'

export default function PartnersPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [partners, setPartners] = useState<Array<{ id: string; email: string; username: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      loadPartners()
    }
  }, [user])

  const loadPartners = async () => {
    if (!user) return
    setLoading(true)
    const data = await getPartners(user.id)
    setPartners(data)
    setLoading(false)
  }

  const handleSelectPartner = (partnerId: string) => {
    navigate(`/app/partner/${partnerId}`)
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
              <h1 className="text-xl font-bold text-gray-100">Lifestyle</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/app/settings')}
                className="text-gray-300 hover:text-gray-100 px-3 py-2 rounded-md text-sm font-medium"
              >
                Settings
              </button>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-100 mb-2">Select a Partner</h2>
          <p className="text-gray-400">Choose who you want to share with</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-400">Loading partners...</div>
          </div>
        ) : partners.length === 0 ? (
          <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700 p-8 text-center">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-xl font-semibold text-gray-100 mb-2">No Partners Yet</h3>
            <p className="text-gray-400 mb-6">
              Link with a partner in Settings to get started sharing notes and calendar events.
            </p>
            <button
              onClick={() => navigate('/app/settings')}
              className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-500 text-sm font-medium"
            >
              Go to Settings
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partners.map((partner) => (
              <button
                key={partner.id}
                onClick={() => handleSelectPartner(partner.id)}
                className="bg-gray-800 p-8 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-left border-2 border-transparent hover:border-indigo-500 group"
              >
                <div className="text-5xl mb-4">👤</div>
                <h3 className="text-2xl font-bold mb-2 text-gray-100 group-hover:text-indigo-400 transition-colors">
                  {partner.username}
                </h3>
                <p className="text-gray-400 text-sm">{partner.email}</p>
                <div className="mt-4 text-indigo-400 font-medium group-hover:text-indigo-300">
                  View shared content →
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

