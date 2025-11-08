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
      description: 'Capture ideas and keep discussions aligned.',
      icon: '📝',
      route: `/app/partner/${partnerId}/notes`,
      gradient: 'from-indigo-500/20 via-indigo-500/10 to-transparent',
      iconBackground: 'bg-indigo-500/20 text-indigo-200',
      borderHover: 'hover:border-indigo-400/60',
      category: 'Collaboration',
      categoryClass: 'bg-indigo-500/15 text-indigo-200 border border-indigo-500/20',
    },
    {
      id: 'calendar',
      title: 'Calendar',
      description: 'Plan together with a shared schedule.',
      icon: '📅',
      route: `/app/partner/${partnerId}/calendar`,
      gradient: 'from-emerald-500/20 via-emerald-500/10 to-transparent',
      iconBackground: 'bg-emerald-500/20 text-emerald-200',
      borderHover: 'hover:border-emerald-400/60',
      category: 'Planning',
      categoryClass: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/20',
    },
    {
      id: 'recipes',
      title: 'Recipes',
      description: 'Discover meals based on your ingredients.',
      icon: '🍳',
      route: `/app/partner/${partnerId}/recipes`,
      gradient: 'from-amber-500/20 via-amber-500/10 to-transparent',
      iconBackground: 'bg-amber-500/20 text-amber-200',
      borderHover: 'hover:border-amber-400/60',
      category: 'Meal Ideas',
      categoryClass: 'bg-amber-500/15 text-amber-200 border border-amber-500/20',
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
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Workspace
          </h2>
          <p className="text-slate-400 text-sm sm:text-base">
            Select a shared area to continue working together.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5">
          {appCards
            .filter((app) => tilePreferences[app.id] !== false)
            .map((app) => (
              <button
                key={app.id}
                onClick={() => navigate(app.route)}
                className={`relative overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 sm:p-6 text-left shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-2xl ${app.borderHover}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${app.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}></div>
                <div className="relative z-10 flex h-full flex-col justify-between gap-6">
                  <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
                    <span className={`rounded-full px-3 py-1 ${app.categoryClass}`}>
                      {app.category}
                    </span>
                  </div>
                  <div className={`w-12 h-12 rounded-xl ${app.iconBackground} flex items-center justify-center text-2xl`}>
                    {app.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{app.title}</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {app.description}
                    </p>
                  </div>
                  <div className="text-xs font-medium text-indigo-300 group-hover:text-white transition-colors">
                    Open →
                  </div>
                </div>
              </button>
            ))}
        </div>
      </main>
    </div>
  )
}

