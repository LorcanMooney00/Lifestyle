import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from '../lib/auth'
import { useAuth } from '../lib/auth'
import { getAllNotes, getEvents, getPartners, getTilePreferences } from '../lib/api'
import type { Note, Event } from '../types'
import PhotoGallery from '../components/PhotoGallery'

export default function TopicsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [partners, setPartners] = useState<Array<{ id: string; email: string; username: string }>>([])
  const [loading, setLoading] = useState(true)
  const [tilePreferences, setTilePreferences] = useState<Record<string, boolean>>({
    'shared-notes': true,
    'calendar': true,
    'recipes': true,
    'photo-gallery': true,
  })

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user])

  const loadDashboardData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const [notesData, partnersData, preferencesData] = await Promise.all([
        getAllNotes(user.id),
        getPartners(user.id),
        getTilePreferences(user.id),
      ])
      setNotes(notesData)
      setPartners(partnersData)
      if (preferencesData.preferences) {
        setTilePreferences(preferencesData.preferences)
      }

      // Get upcoming events (next 30 days)
      const today = new Date()
      const nextMonth = new Date(today)
      nextMonth.setDate(today.getDate() + 30)
      const eventsData = await getEvents(today, nextMonth)
      setEvents(eventsData)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

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
    {
      id: 'recipes',
      title: 'Recipes',
      description: 'Find recipes based on ingredients you have',
      icon: '🍳',
      route: '/app/recipes',
      color: 'bg-orange-500',
      hoverColor: 'hover:bg-orange-600',
    },
  ]

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
          <h2 className="text-3xl font-bold text-gray-100 mb-2">Dashboard</h2>
          <p className="text-gray-400">Choose an app or select a partner to get started</p>
        </div>

        {/* Partner Selection */}
        {!loading && partners.length > 0 && (
          <div className="mb-6 sm:mb-8">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-100 mb-3 sm:mb-4">Your Partners</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
              {partners.map((partner) => (
                <button
                  key={partner.id}
                  onClick={() => navigate(`/app/partner/${partner.id}`)}
                  className="bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-left border-2 border-transparent hover:border-indigo-500 group aspect-square flex flex-col justify-center"
                >
                  <div className="text-2xl sm:text-3xl lg:text-4xl mb-2 sm:mb-3">👤</div>
                  <h4 className="text-sm sm:text-base lg:text-lg font-bold mb-1 text-gray-100 group-hover:text-indigo-400 transition-colors">
                    {partner.username}
                  </h4>
                  <p className="text-gray-400 text-xs sm:text-sm">{partner.email}</p>
                  <div className="mt-2 sm:mt-3 text-indigo-400 font-medium text-xs sm:text-sm group-hover:text-indigo-300">
                    View shared content →
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6 aspect-square flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-400 mb-1">Total Notes</p>
                  <p className="text-xl sm:text-3xl font-bold text-gray-100">{notes.length}</p>
                </div>
                <div className="text-2xl sm:text-4xl">📝</div>
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6 aspect-square flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-400 mb-1">Upcoming Events</p>
                  <p className="text-xl sm:text-3xl font-bold text-gray-100">{events.length}</p>
                </div>
                <div className="text-2xl sm:text-4xl">📅</div>
              </div>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6 aspect-square flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-400 mb-1">Linked Partners</p>
                  <p className="text-xl sm:text-3xl font-bold text-gray-100">{partners.length}</p>
                </div>
                <div className="text-2xl sm:text-4xl">👥</div>
              </div>
            </div>
          </div>
        )}

        {/* App Cards */}
        <div className="mb-6 sm:mb-8">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-100 mb-3 sm:mb-4">Apps</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
            {appCards
              .filter((app) => tilePreferences[app.id] !== false)
              .map((app) => (
                <button
                  key={app.id}
                  onClick={() => navigate(app.route)}
                  className={`${app.color} ${app.hoverColor} text-white p-4 sm:p-6 lg:p-8 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105 text-left group aspect-square flex flex-col justify-center`}
                >
                  <div className="text-3xl sm:text-4xl lg:text-5xl mb-2 sm:mb-3 lg:mb-4">{app.icon}</div>
                  <h3 className="text-lg sm:text-xl lg:text-2xl font-bold mb-1 sm:mb-2">{app.title}</h3>
                  <p className="text-xs sm:text-sm text-indigo-100 group-hover:text-white transition-colors">
                    {app.description}
                  </p>
                </button>
              ))}
          </div>
        </div>

        {/* Photo Gallery Widget */}
        {tilePreferences['photo-gallery'] !== false && (
          <div className="mb-6 sm:mb-8 max-w-xs sm:max-w-sm md:max-w-md mx-auto">
            <PhotoGallery />
          </div>
        )}

        {/* Recent Activity */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            {/* Upcoming Events */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6 aspect-square flex flex-col">
              <div className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0">
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-100">Upcoming Events</h3>
                <button
                  onClick={() => navigate('/app/calendar')}
                  className="text-xs sm:text-sm text-indigo-400 hover:text-indigo-300"
                >
                  View all →
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {events.length === 0 ? (
                  <p className="text-gray-400 text-xs sm:text-sm">No upcoming events</p>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {events.slice(0, 5).map((event) => {
                      const eventDate = new Date(event.event_date)
                      const isToday = eventDate.toDateString() === new Date().toDateString()
                      return (
                        <div
                          key={event.id}
                          className="bg-gray-700 rounded-lg p-2 sm:p-3 hover:bg-gray-600 transition-colors cursor-pointer"
                          onClick={() => navigate('/app/calendar')}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-gray-100 text-sm sm:text-base">{event.title}</p>
                              <p className="text-xs sm:text-sm text-gray-400 mt-1">
                                {isToday ? 'Today' : eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                {event.event_time && ` at ${event.event_time}`}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Notes */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 sm:p-6 aspect-square flex flex-col">
              <div className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0">
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-100">Recent Notes</h3>
                <button
                  onClick={() => navigate('/app/notes')}
                  className="text-xs sm:text-sm text-indigo-400 hover:text-indigo-300"
                >
                  View all →
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {notes.length === 0 ? (
                  <p className="text-gray-400 text-xs sm:text-sm">No notes yet</p>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {notes.slice(0, 5).map((note) => (
                      <div
                        key={note.id}
                        className="bg-gray-700 rounded-lg p-2 sm:p-3 hover:bg-gray-600 transition-colors cursor-pointer"
                        onClick={() => navigate('/app/notes')}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-100 truncate text-sm sm:text-base">
                              {note.title || 'Untitled Note'}
                            </p>
                            {note.content && (
                              <p className="text-xs sm:text-sm text-gray-400 mt-1 truncate">
                                {note.content.substring(0, 60)}
                                {note.content.length > 60 ? '...' : ''}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(note.updated_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
