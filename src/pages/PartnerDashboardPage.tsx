import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getPartners } from '../lib/api'
import { useState, useEffect } from 'react'
import { signOut } from '../lib/auth'

export default function PartnerDashboardPage() {
  const { partnerId } = useParams<{ partnerId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [partnerEmail, setPartnerEmail] = useState<string>('')
  const [partnerUsername, setPartnerUsername] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && partnerId) {
      loadPartnerInfo()
    }
  }, [user, partnerId])

  const loadPartnerInfo = async () => {
    if (!user || !partnerId) return
    setLoading(true)
    const partners = await getPartners(user.id)
    const partner = partners.find((p) => p.id === partnerId)
    if (partner) {
      setPartnerEmail(partner.email)
      setPartnerUsername(partner.username)
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appCards.map((app) => (
            <button
              key={app.id}
              onClick={() => navigate(app.route)}
              className={`${app.color} ${app.hoverColor} text-white p-8 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-left group`}
            >
              <div className="text-5xl mb-4">{app.icon}</div>
              <h3 className="text-2xl font-bold mb-2">{app.title}</h3>
              <p className="text-indigo-100 group-hover:text-white transition-colors">
                {app.description}
              </p>
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}

