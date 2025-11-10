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
    'shopping-list': true,
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
    {
      id: 'shared-todos',
      title: 'Shared To-Do List',
      description: 'Track tasks and celebrate wins together.',
      icon: '✅',
      route: `/app/partner/${partnerId}/todos`,
      gradient: 'from-sky-500/20 via-sky-500/10 to-transparent',
      iconBackground: 'bg-sky-500/20 text-sky-200',
      borderHover: 'hover:border-sky-400/60',
      category: 'Productivity',
      categoryClass: 'bg-sky-500/15 text-sky-200 border border-sky-500/20',
    },
    {
      id: 'shopping-list',
      title: 'Shopping List',
      description: 'Plan grocery runs and keep essentials stocked.',
      icon: '🛒',
      route: `/app/partner/${partnerId}/shopping`,
      gradient: 'from-rose-500/20 via-rose-500/10 to-transparent',
      iconBackground: 'bg-rose-500/20 text-rose-200',
      borderHover: 'hover:border-rose-400/60',
      category: 'Household',
      categoryClass: 'bg-rose-500/15 text-rose-200 border border-rose-500/20',
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 pb-20">
        {/* Header Section */}
        <div className="mb-8 sm:mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center">
              <span className="text-2xl">🤝</span>
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
                Shared Workspace
              </h2>
            </div>
          </div>
          <p className="text-slate-400 text-sm sm:text-base ml-15">
            Collaborate with <span className="text-slate-200 font-medium">{partnerUsername || partnerEmail}</span> on your shared apps
          </p>
        </div>

        {/* App Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {appCards
            .filter((app) => tilePreferences[app.id] !== false)
            .map((app) => (
              <button
                key={app.id}
                onClick={() => navigate(app.route)}
                className={`group relative overflow-hidden rounded-2xl border border-slate-700/50 glass backdrop-blur-xl p-6 text-left shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl ${app.borderHover}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${app.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}></div>
                
                {/* Content */}
                <div className="relative z-10 flex flex-col gap-4">
                  {/* Category Badge */}
                  <div className="flex items-center justify-between">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${app.categoryClass}`}>
                      {app.category}
                    </span>
                  </div>
                  
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-xl ${app.iconBackground} flex items-center justify-center text-3xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    {app.icon}
                  </div>
                  
                  {/* Title & Description */}
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-indigo-200 transition-colors">
                      {app.title}
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {app.description}
                    </p>
                  </div>
                  
                  {/* Action Button */}
                  <div className="flex items-center gap-2 text-indigo-300 font-medium text-sm group-hover:text-indigo-200 transition-colors mt-2">
                    <span>Open Workspace</span>
                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
        </div>

        {/* Empty State */}
        {appCards.filter((app) => tilePreferences[app.id] !== false).length === 0 && (
          <div className="glass backdrop-blur-xl rounded-2xl border border-slate-700/50 p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-700/50 to-slate-800/50 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🔧</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Apps Available</h3>
            <p className="text-slate-400 mb-4">
              Enable workspace apps in your settings to get started
            </p>
            <button
              onClick={() => navigate('/app/settings')}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 rounded-xl text-white font-medium hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              <span>⚙️</span>
              <span>Open Settings</span>
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

