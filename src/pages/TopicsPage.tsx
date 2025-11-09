import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from '../lib/auth'
import { useAuth } from '../lib/auth'
import {
  getAllNotes,
  getEvents,
  getPartners,
  getShoppingItems,
  getTilePreferences,
  linkPartner,
  unlinkPartner,
  getTodos,
  createTodo,
  toggleTodoCompletion,
  deleteTodo,
} from '../lib/api'
import type { Note, Event, Todo, ShoppingItem } from '../types'
import PhotoWidget from '../components/PhotoWidget'
import TodoWidget from '../components/TodoWidget'

const defaultTilePreferences: Record<string, boolean> = {
  'shared-notes': true,
  'calendar': true,
  'recipes': true,
  'photo-gallery': true,
  'shared-todos': true,
  'shopping-list': true,
}

export default function TopicsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([])
  const [partners, setPartners] = useState<Array<{ id: string; email: string; username: string; profilePictureUrl?: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [tilePreferences, setTilePreferences] = useState<Record<string, boolean>>(defaultTilePreferences)
  const [todos, setTodos] = useState<Todo[]>([])
  const [creatingTodo, setCreatingTodo] = useState(false)
  const [todoActionIds, setTodoActionIds] = useState<string[]>([])
  const [todoError, setTodoError] = useState<string | null>(null)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const contentWidth = 'max-w-5xl mx-auto w-full'

  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false)
  const [partnerEmail, setPartnerEmail] = useState('')
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null)
  const [showUnlinkModal, setShowUnlinkModal] = useState(false)
  const [partnerToUnlink, setPartnerToUnlink] = useState<{ id: string; email: string; username: string; profilePictureUrl?: string | null } | null>(null)
  const [unlinking, setUnlinking] = useState(false)

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user])

  const loadDashboardData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const today = new Date()
      const nextMonth = new Date(today)
      nextMonth.setDate(today.getDate() + 30)

      const [notesData, partnersData, preferencesData, todosData, eventsData, shoppingData] = await Promise.all([
        getAllNotes(user.id),
        getPartners(user.id),
        getTilePreferences(user.id),
        getTodos(user.id),
        getEvents(today, nextMonth),
        getShoppingItems(user.id),
      ])

      setNotes(notesData)
      setPartners(partnersData)
      if (preferencesData.preferences) {
        setTilePreferences({ ...defaultTilePreferences, ...preferencesData.preferences })
      } else {
        setTilePreferences(defaultTilePreferences)
      }
      setTodos(todosData)
      setEvents(eventsData)
      setShoppingItems(shoppingData)
      setTodoError(null)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      setTodoError('Could not load shared to-do list. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  const highlightConfigs = useMemo(() => {
    const configs: Array<{
      type: 'events' | 'notes' | 'todos' | 'shopping'
      title: string
      subtitle: string
      icon: string
      viewAllPath: string
    }> = []

    if (tilePreferences['calendar'] !== false) {
      configs.push({
        type: 'events',
        title: 'Upcoming Events',
        subtitle: 'Stay aligned on what’s next.',
        icon: '📅',
        viewAllPath: '/app/calendar',
      })
    }

    configs.push({
      type: 'notes',
      title: 'Recent Notes',
      subtitle: 'Check the latest shared thoughts.',
      icon: '📝',
      viewAllPath: '/app/notes',
    })

    if (tilePreferences['shared-todos'] !== false) {
      configs.push({
        type: 'todos',
        title: 'Shared To-Do List',
        subtitle: 'Check shared tasks in motion together.',
        icon: '✅',
        viewAllPath: '/app/todos',
      })
    }

    if (tilePreferences['shopping-list'] !== false) {
      configs.push({
        type: 'shopping',
        title: 'Shopping List',
        subtitle: 'Keep your grocery game tight and tidy.',
        icon: '🛒',
        viewAllPath: '/app/shopping',
      })
    }

    return configs
  }, [tilePreferences])

  useEffect(() => {
    if (highlightIndex >= highlightConfigs.length) {
      setHighlightIndex(0)
    }
  }, [highlightConfigs, highlightIndex])

  const currentHighlight = highlightConfigs[highlightIndex]

  const handleCreateTodo = async (content: string) => {
    if (!user) return
    setCreatingTodo(true)
    setTodoError(null)
    try {
      const { todo, error } = await createTodo(user.id, content, null)
      if (error || !todo) {
        setTodoError(error || 'Failed to create to-do. Please try again.')
        return
      }
      setTodos((prev) => [...prev, todo])
    } catch (error) {
      console.error('Error creating todo:', error)
      setTodoError('Failed to create to-do. Please try again.')
    } finally {
      setCreatingTodo(false)
    }
  }

  const handleToggleTodo = async (todoId: string, completed: boolean) => {
    setTodoActionIds((prev) => [...prev, todoId])
    setTodoError(null)
    try {
      const { todo, error } = await toggleTodoCompletion(todoId, completed)
      if (error || !todo) {
        setTodoError(error || 'Failed to update to-do. Please try again.')
        return
      }
      setTodos((prev) => prev.map((item) => (item.id === todo.id ? todo : item)))
    } catch (error) {
      console.error('Error toggling todo:', error)
      setTodoError('Failed to update to-do. Please try again.')
    } finally {
      setTodoActionIds((prev) => prev.filter((id) => id !== todoId))
    }
  }

  const handleDeleteTodo = async (todoId: string) => {
    setTodoActionIds((prev) => [...prev, todoId])
    setTodoError(null)
    try {
      const { success, error } = await deleteTodo(todoId)
      if (!success) {
        setTodoError(error || 'Failed to delete to-do. Please try again.')
        return
      }
      setTodos((prev) => prev.filter((todo) => todo.id !== todoId))
    } catch (error) {
      console.error('Error deleting todo:', error)
      setTodoError('Failed to delete to-do. Please try again.')
    } finally {
      setTodoActionIds((prev) => prev.filter((id) => id !== todoId))
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleLinkPartner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !partnerEmail.trim()) return

    setLinking(true)
    setLinkError(null)
    setLinkSuccess(null)

    const success = await linkPartner(user.id, partnerEmail.trim())
    if (success) {
      setLinkSuccess('Partner linked successfully!')
      setPartnerEmail('')
      await loadDashboardData()
      setTimeout(() => {
        setShowAddPartnerModal(false)
        setLinkSuccess(null)
      }, 1500)
    } else {
      setLinkError('Failed to link partner. Make sure they have an account with this email.')
    }

    setLinking(false)
  }

  const handleOpenAddPartner = () => {
    setShowAddPartnerModal(true)
    setPartnerEmail('')
    setLinkError(null)
    setLinkSuccess(null)
  }

  const handleCloseAddPartner = () => {
    setShowAddPartnerModal(false)
    setPartnerEmail('')
    setLinkError(null)
    setLinkSuccess(null)
  }

  const handleUnlinkPartner = (partner: { id: string; email: string; username: string; profilePictureUrl?: string | null }, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent navigation to partner dashboard
    setPartnerToUnlink(partner)
    setShowUnlinkModal(true)
  }

  const handleConfirmUnlink = async () => {
    if (!user || !partnerToUnlink) return

    setUnlinking(true)
    const success = await unlinkPartner(user.id, partnerToUnlink.id)
    setUnlinking(false)

    if (success) {
      setShowUnlinkModal(false)
      setPartnerToUnlink(null)
      await loadDashboardData()
    } else {
      alert('Failed to unlink partner. Please try again.')
    }
  }

  const handleCancelUnlink = () => {
    setShowUnlinkModal(false)
    setPartnerToUnlink(null)
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.round(diffMs / (1000 * 60))

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`

    const diffHours = Math.round(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    const diffDays = Math.round(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }


  return (
    <div className="min-h-screen">
      <nav className="glass backdrop-blur-xl shadow-lg border-b border-slate-700/40 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-rose-300 bg-clip-text text-transparent">
                Lifestyle
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Photo Widget Banner */}
        {!loading && tilePreferences['photo-gallery'] !== false && (
          <div className={`${contentWidth} mb-6 sm:mb-8 md:mb-10`}>
            <PhotoWidget photoIndex={1} wide={true} />
          </div>
        )}

        {/* Highlighted shared activity */}
        {!loading && currentHighlight && (
          <div className="mb-6 sm:mb-8 md:mb-10">
            <div className={`${contentWidth} space-y-4`}>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 w-6 rounded-l-2xl bg-gradient-to-r from-slate-950 via-slate-950/60 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-6 rounded-r-2xl bg-gradient-to-l from-slate-950 via-slate-950/60 to-transparent" />
                <div className="scrollbar-none flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl border border-slate-700/60 bg-slate-900/70 p-1 text-sm text-slate-300">
                  {highlightConfigs.map((config, index) => {
                    const isActive = highlightIndex === index
                    const label =
                      config.type === 'events'
                        ? 'Events'
                        : config.type === 'notes'
                        ? 'Notes'
                        : config.type === 'todos'
                        ? 'To-Dos'
                        : config.type === 'shopping'
                        ? 'Shopping'
                        : config.title

                    return (
                      <button
                        key={config.type}
                        onClick={() => setHighlightIndex(index)}
                        className={`group flex snap-start items-center gap-2 rounded-xl px-4 py-2 transition ${
                          isActive
                            ? 'bg-indigo-500/25 text-indigo-100 shadow-inner shadow-indigo-900/40'
                            : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                        }`}
                        aria-pressed={isActive}
                      >
                        <span className="text-lg">{config.icon}</span>
                        <span className="text-xs font-semibold uppercase tracking-wide sm:text-[13px]">
                          {label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="glass backdrop-blur-sm border border-slate-600/40 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden w-full">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800/40 via-slate-900/40 to-slate-900/10 pointer-events-none"></div>
                <div className="relative z-10 flex flex-col gap-5 min-h-[420px] sm:min-h-[400px] md:min-h-[440px]">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 text-white">
                        <span className="text-2xl">{currentHighlight.icon}</span>
                        <h3 className="text-xl font-semibold">{currentHighlight.title}</h3>
                      </div>
                      <p className="text-sm text-slate-400 mt-1">{currentHighlight.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => navigate(currentHighlight.viewAllPath)}
                        className="rounded-full border border-indigo-500/40 bg-indigo-500/20 px-3 py-2 text-sm font-medium text-indigo-200 transition-all hover:bg-indigo-500/30"
                      >
                        View all →
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 flex-1 overflow-y-auto pr-1 pb-1 min-h-[360px]">
                      {currentHighlight.type === 'events' && (
                        <>
                          {events.length === 0 ? (
                            <p className="text-sm text-slate-400">No upcoming events</p>
                          ) : (
                            events
                              .slice()
                              .sort(
                                (a, b) =>
                                  new Date(a.event_date).getTime() -
                                  new Date(b.event_date).getTime()
                              )
                              .slice(0, 5)
                              .map((event) => {
                                const eventDate = new Date(event.event_date)
                                const today = new Date()
                                today.setHours(0, 0, 0, 0)
                                const eventDateOnly = new Date(eventDate)
                                eventDateOnly.setHours(0, 0, 0, 0)
                                const diffTime = eventDateOnly.getTime() - today.getTime()
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                                let timeLabel = ''
                                if (diffDays === 0) {
                                  timeLabel = 'Today'
                                } else if (diffDays === 1) {
                                  timeLabel = 'Tomorrow'
                                } else if (diffDays > 1 && diffDays <= 30) {
                                  timeLabel = `In ${diffDays} days`
                                } else {
                                  timeLabel = eventDate.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                }

                                return (
                                  <div
                                    key={event.id}
                                    className="rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-3 text-sm text-white transition-colors hover:border-indigo-400/50 cursor-pointer"
                                    onClick={() => navigate('/app/calendar')}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex-1 min-w-0 flex items-center gap-3">
                                        <span className="text-lg">📅</span>
                                        <div className="min-w-0">
                                          <p className="font-medium truncate">{event.title}</p>
                                          {event.description && (
                                            <p className="mt-1 text-xs text-slate-400 line-clamp-1">
                                              {event.description}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-end gap-1 text-xs text-slate-300 whitespace-nowrap">
                                        {event.event_time && <span>{event.event_time}</span>}
                                        <span className="rounded-md border border-slate-600/50 bg-slate-700/60 px-2 py-0.5">
                                          {timeLabel}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })
                          )}
                        </>
                      )}

                      {currentHighlight.type === 'notes' && (
                        <>
                          {notes.length === 0 ? (
                            <p className="text-sm text-slate-400">No recent notes</p>
                          ) : (
                            notes
                              .slice()
                              .sort(
                                (a, b) =>
                                  new Date(b.updated_at).getTime() -
                                  new Date(a.updated_at).getTime()
                              )
                              .slice(0, 5)
                              .map((note) => {
                                const preview =
                                  note.content?.trim().replace(/\s+/g, ' ').slice(0, 140) ||
                                  'No content yet—tap to add your thoughts.'
                                const relativeTime = formatRelativeTime(note.updated_at)
                                const partnerLabel =
                                  note.partners && note.partners.length > 1
                                    ? note.partners.join(' & ')
                                    : null

                                return (
                                  <div
                                    key={note.id}
                                    className="group rounded-2xl border border-slate-700/60 bg-gradient-to-r from-slate-900/85 via-slate-900/70 to-slate-900/40 px-4 py-4 text-sm text-white shadow-lg transition-all hover:-translate-y-0.5 hover:border-indigo-400/60 hover:shadow-indigo-900/30 cursor-pointer"
                                    onClick={() => navigate('/app/notes')}
                                  >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                      <div className="flex flex-1 items-start gap-3">
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-lg text-indigo-200 transition-all group-hover:bg-indigo-500/25">
                                          📝
                                        </div>
                                        <div className="min-w-0 space-y-2">
                                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                            <p className="truncate text-base font-semibold">
                                              {note.title || 'Untitled Note'}
                                            </p>
                                            <span className="flex-shrink-0 text-xs text-indigo-200/80">
                                              {relativeTime}
                                            </span>
                                          </div>
                                          <p className="text-xs text-slate-300 line-clamp-2 break-words">
                                            {preview}
                                            {note.content && note.content.trim().length > 140 && '…'}
                                          </p>
                                          {partnerLabel && (
                                            <div className="flex flex-wrap gap-2 text-[11px] text-indigo-200/80">
                                              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2 py-0.5 uppercase tracking-wide">
                                                {partnerLabel}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })
                          )}
                        </>
                      )}

                      {currentHighlight.type === 'todos' && (
                        <TodoWidget
                          variant="embedded"
                          showHeader={false}
                          maxItems={5}
                          todos={todos}
                          partners={partners}
                          creating={creatingTodo}
                          actionIds={todoActionIds}
                          error={todoError}
                          sharingLabel={partners.length > 0 ? 'all linked partners' : 'your account'}
                          onCreate={handleCreateTodo}
                          onToggle={handleToggleTodo}
                          onDelete={handleDeleteTodo}
                          className="w-full"
                        />
                      )}

                      {currentHighlight.type === 'shopping' && (
                        <>
                          {shoppingItems.filter((item) => !item.purchased).length === 0 ? (
                            <p className="text-sm text-slate-400">
                              Nothing on your list right now. Add something to keep tabs on it.
                            </p>
                          ) : (
                            shoppingItems
                              .filter((item) => !item.purchased)
                              .slice()
                              .sort(
                                (a, b) =>
                                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                              )
                              .slice(0, 5)
                              .map((item) => {
                                const partner =
                                  item.partner_id && partners.find((p) => p.id === item.partner_id)
                                const sharedLabel = partner
                                  ? partner.username || partner.email
                                  : 'Just you'

                                return (
                                  <div
                                    key={item.id}
                                    className="rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-3 text-sm text-white transition-colors hover:border-indigo-400/50 cursor-pointer"
                                    onClick={() => navigate('/app/shopping')}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex-1 min-w-0 flex items-center gap-3">
                                        <span className="text-lg">🛒</span>
                                        <div className="min-w-0">
                                          <p className="font-medium truncate">{item.item_name}</p>
                                          <p className="mt-1 text-xs text-slate-400 line-clamp-1">
                                            Shared with: {sharedLabel}
                                          </p>
                                        </div>
                                      </div>
                                      {item.quantity && (
                                        <span className="rounded-md border border-indigo-500/30 bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-200">
                                          {item.quantity}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
            </div>
          </div>
        )}


        {/* Partner Selection and Quick Stats with Photo Widget 1 spanning both */}
        {!loading && (
          <div className={`${contentWidth} mb-6 sm:mb-8 md:mb-10`}>
            <h3 className="text-lg sm:text-xl font-semibold text-white mb-4 sm:mb-5 flex items-center gap-2">
              <span className="text-xl sm:text-2xl">👥</span>
              Your Partners
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-8 lg:grid-cols-9 xl:grid-cols-10 2xl:grid-cols-11 gap-3 sm:gap-4 md:gap-4 lg:gap-4 xl:gap-4 2xl:gap-4 items-stretch">
              {/* Row 1: Partners */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-3 lg:gap-3 xl:gap-3 2xl:gap-3 md:col-span-5 lg:col-span-5 xl:col-span-5 2xl:col-span-5">
                {partners.map((partner) => (
                  <div
                    key={partner.id}
                    onClick={() => navigate(`/app/partner/${partner.id}`)}
                    className="glass backdrop-blur-sm border border-slate-600/40 p-3 sm:p-4 rounded-2xl shadow-lg card-hover text-left group aspect-square flex flex-col justify-center overflow-hidden relative cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/8 to-pink-500/8 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                    {/* Unlink Button - Top Right */}
                    <button
                      onClick={(e) => handleUnlinkPartner(partner, e)}
                      className="absolute top-2 right-2 z-20 p-1.5 sm:p-2 rounded-lg bg-red-600/80 hover:bg-red-600 active:bg-red-700 text-white transition-all shadow-lg hover:shadow-xl opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                      title="Unlink partner"
                      aria-label="Unlink partner"
                    >
                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="relative z-10">
                      {partner.profilePictureUrl ? (
                        <div className="w-12 h-12 sm:w-14 sm:h-14 mb-2 mx-auto rounded-full overflow-hidden border-2 border-purple-400/40 shadow-lg flex-shrink-0">
                          <img
                            src={partner.profilePictureUrl}
                            alt={partner.username}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="text-2xl sm:text-3xl mb-2 flex-shrink-0">👤</div>
                      )}
                      <h4 className="text-xs sm:text-sm font-bold mb-1 text-white group-hover:text-purple-200 transition-colors truncate">
                        {partner.username}
                      </h4>
                      <p className="text-[10px] sm:text-xs text-slate-400 truncate mb-2">{partner.email}</p>
                      <div className="text-purple-300 font-medium text-[10px] sm:text-xs group-hover:text-purple-200 transition-colors">
                        View →
                      </div>
                    </div>
                  </div>
                ))}
                {/* Add Partner Card */}
                <button
                  onClick={handleOpenAddPartner}
                  className="glass backdrop-blur-sm border-2 border-dashed border-purple-400/40 p-3 sm:p-4 rounded-2xl shadow-lg card-hover text-left group aspect-square flex flex-col justify-center overflow-hidden relative hover:border-purple-300/50 transition-all"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/8 to-pink-500/8 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                  <div className="relative z-10 flex flex-col items-center justify-center text-center">
                    <div className="text-3xl sm:text-4xl mb-2 flex-shrink-0">➕</div>
                    <h4 className="text-xs sm:text-sm font-bold mb-1 text-purple-200 group-hover:text-purple-100 transition-colors">
                      Add Partner
                    </h4>
                    <p className="text-[10px] sm:text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
                      Link a new partner
                    </p>
                  </div>
                </button>
              </div>

              {/* Photo Widget 1 - Spans over both rows (Partners and Quick Stats) - Dynamically sized */}
              {tilePreferences['photo-gallery'] !== false && (
                <div className="md:col-span-3 lg:col-span-4 xl:col-span-5 2xl:col-span-6 row-span-2 self-stretch">
                  <PhotoWidget photoIndex={0} fillHeight={true} />
                </div>
              )}

              {/* Row 2: Quick Stats - Made smaller */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 md:gap-3 lg:gap-3 xl:gap-3 2xl:gap-3 md:col-span-5 lg:col-span-5 xl:col-span-5 2xl:col-span-5">
                <div className="glass backdrop-blur-sm border border-slate-600/40 rounded-2xl p-3 sm:p-4 aspect-square flex flex-col justify-center card-hover shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] sm:text-xs text-slate-400 mb-1 truncate">Total Notes</p>
                      <p className="text-lg sm:text-xl md:text-2xl lg:text-xl xl:text-2xl 2xl:text-lg font-bold text-white">{notes.length}</p>
                    </div>
                    <div className="text-2xl sm:text-3xl flex-shrink-0 ml-2">📝</div>
                  </div>
                </div>
                <div className="glass backdrop-blur-sm border border-slate-600/40 rounded-2xl p-3 sm:p-4 aspect-square flex flex-col justify-center card-hover shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] sm:text-xs text-slate-400 mb-1 truncate">Upcoming Events</p>
                      <p className="text-lg sm:text-xl md:text-2xl lg:text-xl xl:text-2xl 2xl:text-lg font-bold text-white">{events.length}</p>
                    </div>
                    <div className="text-2xl sm:text-3xl flex-shrink-0 ml-2">📅</div>
                  </div>
                </div>
                <div className="glass backdrop-blur-sm border border-slate-600/40 rounded-2xl p-3 sm:p-4 aspect-square flex flex-col justify-center card-hover shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] sm:text-xs text-slate-400 mb-1 truncate">Linked Partners</p>
                      <p className="text-lg sm:text-xl md:text-2xl lg:text-xl xl:text-2xl 2xl:text-lg font-bold text-white">{partners.length}</p>
                    </div>
                    <div className="text-2xl sm:text-3xl flex-shrink-0 ml-2">👥</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Partner Modal */}
        {showAddPartnerModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md border border-slate-600/50">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-white">Link a Partner</h3>
                  <button
                    onClick={handleCloseAddPartner}
                    className="text-slate-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors rounded-lg hover:bg-slate-700/50"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {linkError && (
                  <div className="mb-4 p-4 bg-red-900/30 border border-red-700/50 rounded-xl">
                    <p className="text-sm text-red-300">{linkError}</p>
                  </div>
                )}

                {linkSuccess && (
                  <div className="mb-4 p-4 bg-green-900/30 border border-green-700/50 rounded-xl">
                    <p className="text-sm text-green-300">{linkSuccess}</p>
                  </div>
                )}

                <form onSubmit={handleLinkPartner} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Partner's Email Address *
                    </label>
                    <input
                      type="email"
                      value={partnerEmail}
                      onChange={(e) => setPartnerEmail(e.target.value)}
                      placeholder="partner@example.com"
                      required
                      className="w-full px-4 py-3 text-base border border-slate-600 bg-slate-700/50 text-white placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      disabled={linking}
                    />
                    <p className="mt-2 text-xs text-slate-400">
                      Your partner needs to have an account with this email address.
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleCloseAddPartner}
                      disabled={linking}
                      className="flex-1 px-6 py-3 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 active:bg-slate-500 text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={linking || !partnerEmail.trim()}
                      className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all shadow-lg hover:shadow-xl active:scale-95"
                    >
                      {linking ? 'Linking...' : 'Link Partner'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Unlink Partner Confirmation Modal */}
        {showUnlinkModal && partnerToUnlink && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md border border-red-600/50">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-1">Unlink Partner?</h3>
                    <p className="text-sm text-slate-400">This action cannot be undone</p>
                  </div>
                  <button
                    onClick={handleCancelUnlink}
                    className="text-slate-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors rounded-lg hover:bg-slate-700/50"
                    aria-label="Close"
                    disabled={unlinking}
                  >
                    ×
                  </button>
                </div>

                <div className="mb-6 p-4 bg-slate-700/30 rounded-xl border border-slate-600/50">
                  <p className="text-sm text-slate-300 mb-2">
                    Are you sure you want to unlink from:
                  </p>
                  <div className="flex items-center gap-3">
                    {partnerToUnlink.profilePictureUrl ? (
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-indigo-500/50 shadow-lg flex-shrink-0">
                        <img
                          src={partnerToUnlink.profilePictureUrl}
                          alt={partnerToUnlink.username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="text-2xl">👤</div>
                    )}
                    <div>
                      <p className="font-semibold text-white">{partnerToUnlink.username}</p>
                      <p className="text-xs text-slate-400">{partnerToUnlink.email}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-xl">
                  <p className="text-xs text-yellow-300">
                    ⚠️ This will remove all shared access. You'll need to link again to share notes, events, and recipes.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancelUnlink}
                    disabled={unlinking}
                    className="flex-1 px-6 py-3 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 active:bg-slate-500 text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmUnlink}
                    disabled={unlinking}
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-500 active:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all shadow-lg hover:shadow-xl active:scale-95"
                  >
                    {unlinking ? 'Unlinking...' : 'Yes, Unlink'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

