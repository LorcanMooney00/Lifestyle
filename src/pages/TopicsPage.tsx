import { useNavigate } from 'react-router-dom'
import { signOut } from '../lib/auth'

export default function TopicsPage() {
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // Dashboard app cards - easy to add more later!
  const appCards = [
    {
      id: 'shared-notes',
      title: 'Shared Notes',
      description: 'Create and share notes with your partner',
      icon: '📝',
      route: '/app/notes',
      color: 'bg-indigo-500',
      hoverColor: 'hover:bg-indigo-600',
    },
    {
      id: 'calendar',
      title: 'Calendar',
      description: 'Shared calendar and events',
      icon: '📅',
      route: '/app/calendar',
      color: 'bg-green-500',
      hoverColor: 'hover:bg-green-600',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Lifestyle</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/app/settings')}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Settings
              </button>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
          <p className="text-gray-600">Choose an app to get started</p>
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

        {/* Placeholder for future apps - uncomment and customize when ready */}
        {/* 
        <div className="mt-12">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Coming Soon</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white border-2 border-dashed border-gray-300 p-8 rounded-xl text-center opacity-50">
              <div className="text-4xl mb-4">📅</div>
              <h4 className="text-lg font-semibold text-gray-700 mb-2">Calendar</h4>
              <p className="text-sm text-gray-500">Coming soon</p>
            </div>
          </div>
        </div>
        */}
      </main>
    </div>
  )
}
