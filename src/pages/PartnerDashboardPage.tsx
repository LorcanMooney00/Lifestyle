import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getPartners, getTilePreferences } from '../lib/api'
import { useState, useEffect } from 'react'
import { signOut } from '../lib/auth'

export default function PartnerDashboardPage() {
  const { partnerId } = useParams<{ partnerId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [partnerEmail, setPartnerEmail] = useState<string>('')
  const [partnerUsername, setPartnerUsername] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [tilePreferences, setTilePreferences] = useState<Record<string, boolean>>({
    'shared-notes': true,
    'calendar': true,
    'recipes': true,
  })

  useEffect(() => {
    if (user && partnerId) {
      loadPartnerInfo()
    }
  }, [user, partnerId])

  const loadPartnerInfo = async () => {
    if (!user || !partnerId) return
    setLoading(true)
    const [partners, preferencesData] = await Promise.all([
      getPartners(user.id),
      getTilePreferences(user.id),
    ])
    const partner = partners.find((p) => p.id === partnerId)
    if (partner) {
      setPartnerEmail(partner.email)
      setPartnerUsername(partner.username)
    }
    if (preferencesData.preferences) {
      setTilePreferences(preferencesData.preferences)
    }
    setLoading(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // Dashboard app cards for the selected partner
  const appCards = [
    {
      id: 'shared-notes',
      title: 'Shared Notes',
      description: 'Create and share notes',
      icon: '📝',
      route: `/app/partner/${partnerId}/notes`,
      color: 'bg-indigo-500',
      hoverColor: 'hover:bg-indigo-600',
    },
    {
      id: 'calendar',
      title: 'Calendar',
      description: 'Shared calendar and events',
      icon: '📅',
      route: `/app/partner/${partnerId}/calendar`,
      color: 'bg-green-500',
      hoverColor: 'hover:bg-green-600',
    },
    {
      id: 'recipes',
      title: 'Recipes',
      description: 'Find recipes based on ingredients',
      icon: '🍳',
      route: `/app/partner/${partnerId}/recipes`,
      color: 'bg-orange-500',
      hoverColor: 'hover:bg-orange-600',
    },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/app/topics')}
                className="text-gray-300 hover:text-gray-100"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-xl font-bold text-gray-100">
                {partnerUsername || partnerEmail || 'Partner'}
              </h1>
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
          <h2 className="text-3xl font-bold text-gray-100 mb-2">Dashboard</h2>
          <p className="text-gray-400">Choose an app to get started</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4 lg:gap-3 xl:gap-4 2xl:gap-3">
          {appCards
            .filter((app) => tilePreferences[app.id] !== false)
            .map((app) => (
              <button
                key={app.id}
                onClick={() => navigate(app.route)}
                className={`${app.color} ${app.hoverColor} text-white p-3 sm:p-4 md:p-5 lg:p-4 xl:p-5 2xl:p-4 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-left group aspect-square flex flex-col justify-center`}
              >
                <div className="text-2xl sm:text-3xl md:text-4xl lg:text-3xl xl:text-4xl 2xl:text-3xl mb-1 sm:mb-2 md:mb-3 lg:mb-2 xl:mb-3 2xl:mb-2">{app.icon}</div>
                <h3 className="text-sm sm:text-base md:text-lg lg:text-base xl:text-lg 2xl:text-base font-bold mb-1 sm:mb-2">{app.title}</h3>
                <p className="text-xs sm:text-sm text-indigo-100 group-hover:text-white transition-colors line-clamp-2">
                  {app.description}
                </p>
              </button>
            ))}
        </div>
      </main>
    </div>
  )
}

