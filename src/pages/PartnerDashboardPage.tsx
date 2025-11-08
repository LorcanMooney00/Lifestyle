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
  const defaultTilePreferences: Record<string, boolean> = {
    'shared-notes': true,
    'calendar': true,
    'recipes': true,
    'shared-todos': true,
  }
  const [tilePreferences, setTilePreferences] = useState<Record<string, boolean>>(defaultTilePreferences)

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
      setTilePreferences({ ...defaultTilePreferences, ...preferencesData.preferences })
    } else {
      setTilePreferences(defaultTilePreferences)
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
    {
      id: 'shared-todos',
      title: 'Shared To-Do List',
      description: 'Track tasks together',
      icon: '✅',
      route: `/app/partner/${partnerId}/todos`,
      color: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-600',
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
    <div className="min-h-screen">
      <nav className="glass backdrop-blur-xl shadow-lg border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/app/topics')}
                className="text-slate-300 hover:text-white transition-colors"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                {partnerUsername || partnerEmail || 'Partner'}
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/app/settings')}
                className="text-slate-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-slate-700/50 active:scale-95"
              >
                ⚙️ Settings
              </button>
              <button
                onClick={handleSignOut}
                className="text-slate-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-slate-700/50 active:scale-95"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Dashboard</h2>
          <p className="text-slate-400 text-sm sm:text-base">Choose an app to get started</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4 md:gap-4 lg:gap-4 xl:gap-4 2xl:gap-4">
          {appCards
            .filter((app) => tilePreferences[app.id] !== false)
            .map((app) => (
              <button
                key={app.id}
                onClick={() => navigate(app.route)}
                className={`${app.color} ${app.hoverColor} text-white p-4 sm:p-5 md:p-6 lg:p-5 xl:p-6 2xl:p-5 rounded-2xl shadow-lg card-hover text-left group aspect-square flex flex-col justify-center relative overflow-hidden`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="text-3xl sm:text-4xl md:text-5xl lg:text-4xl xl:text-5xl 2xl:text-4xl mb-2 sm:mb-3 md:mb-4 lg:mb-3 xl:mb-4 2xl:mb-3">{app.icon}</div>
                  <h3 className="text-sm sm:text-base md:text-lg lg:text-base xl:text-lg 2xl:text-base font-bold mb-1 sm:mb-2">{app.title}</h3>
                  <p className="text-xs sm:text-sm text-white/80 group-hover:text-white transition-colors line-clamp-2">
                    {app.description}
                  </p>
                </div>
              </button>
            ))}
        </div>
      </main>
    </div>
  )
}

