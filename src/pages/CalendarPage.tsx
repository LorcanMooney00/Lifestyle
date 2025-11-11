import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { signOut } from '../lib/auth'
import { getEvents, createEvent, updateEvent, deleteEvent } from '../lib/api'
import type { Event } from '../types'

export default function CalendarPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { partnerId } = useParams<{ partnerId?: string }>()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [showEventForm, setShowEventForm] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [eventDescription, setEventDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadEvents()
    }
  }, [user, currentDate, partnerId])

  useEffect(() => {
    if (selectedEvent) {
      setEventTitle(selectedEvent.title)
      setEventDescription(selectedEvent.description || '')
      setEventDate(selectedEvent.event_date)
      setEventTime(selectedEvent.event_time || '')
      setShowEventForm(true)
    }
  }, [selectedEvent])

  const loadEvents = async () => {
    if (!user) return
    const { year, month } = getDaysInMonth(currentDate)
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    // If viewing a specific partner's calendar, filter by partnerId
    // If viewing main calendar (no partnerId), filter by currentUserId to show only your events
    const data = await getEvents(firstDay, lastDay, partnerId || undefined, partnerId ? undefined : user.id)
    setEvents(data)
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    return { daysInMonth, startingDayOfWeek, year, month }
  }

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate)

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const getEventsForDay = (day: number): Event[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter((event) => event.event_date === dateStr)
  }

  const handleDayClick = (day: number) => {
    // Don't allow creating new events without a partner selected
    if (!partnerId) {
      return
    }
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setEventDate(dateStr)
    setEventTitle('')
    setEventDescription('')
    setEventTime('')
    setSelectedEvent(null)
    setError(null)
    setShowEventForm(true)
  }

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !eventTitle.trim() || !eventDate) return

    // Don't allow creating new events without a partner selected
    if (!selectedEvent && !partnerId) {
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (selectedEvent) {
        // Update existing event
        const updated = await updateEvent(selectedEvent.id, {
          title: eventTitle.trim(),
          description: eventDescription.trim() || null,
          event_date: eventDate,
          event_time: eventTime || null,
        })
        if (updated) {
          await loadEvents()
          setShowEventForm(false)
          setSelectedEvent(null)
        } else {
          setError('Failed to update event. Please try again.')
        }
      } else {
        // Create new event (only if partnerId is present)
        if (!partnerId) {
          setSaving(false)
          return
        }
        const newEvent = await createEvent(
          eventTitle.trim(),
          eventDescription.trim() || null,
          eventDate,
          eventTime || null,
          user.id,
          partnerId || undefined
        )
        if (newEvent) {
          await loadEvents()
          setShowEventForm(false)
        } else {
          setError('Failed to create event. The partner_id column may be missing from your database. Please add it to enable event creation.')
        }
      }
    } catch (err) {
      console.error('Error saving event:', err)
      setError('An error occurred while saving the event. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteEvent = async () => {
    if (!selectedEvent || !confirm('Are you sure you want to delete this event?')) return

    const success = await deleteEvent(selectedEvent.id)
    if (success) {
      await loadEvents()
      setShowEventForm(false)
      setSelectedEvent(null)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const renderCalendarDays = () => {
    const days = []
    
    // Empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(
        <div key={`empty-${i}`} className="min-h-[75px] sm:min-h-[100px] min-w-[85px] sm:min-w-[100px] p-2 rounded-xl bg-slate-900/20 border-2 border-slate-700/20"></div>
      )
    }

    // Days of the month
    const today = new Date()
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year
    
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = isCurrentMonth && day === today.getDate()
      const dayEvents = getEventsForDay(day)
      
      days.push(
        <div
          key={day}
          onClick={() => handleDayClick(day)}
          className={`min-h-[75px] sm:min-h-[100px] min-w-[85px] sm:min-w-[100px] p-2.5 sm:p-3 rounded-xl border-2 flex flex-col transition-all ${
            isToday 
              ? 'bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border-indigo-400/60 shadow-lg shadow-indigo-500/30' 
              : 'bg-slate-800/60 backdrop-blur-sm border-slate-600/50 hover:border-slate-500/60'
          } ${
            partnerId 
              ? 'hover:bg-slate-700/60 active:bg-slate-600/60 cursor-pointer active:scale-[0.98]' 
              : 'cursor-not-allowed opacity-60'
          }`}
        >
          <div className={`text-sm sm:text-lg mb-1.5 sm:mb-2 font-bold ${
            isToday ? 'text-indigo-100' : 'text-slate-100'
          }`}>
            {day}
          </div>
          <div className="flex-1 flex flex-col gap-1 sm:gap-1.5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
            {dayEvents.map((event) => (
              <div
                key={event.id}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedEvent(event)
                }}
                className="text-xs bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-2 py-1.5 rounded-lg hover:from-indigo-500 hover:to-indigo-400 active:from-indigo-700 active:to-indigo-600 flex flex-col shadow-md cursor-pointer transition-all"
                title={event.title + (event.description ? `: ${event.description}` : '')}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="font-semibold leading-tight flex-1 break-words">{event.title}</span>
                  {event.event_time && (
                    <span className="text-[10px] opacity-90 font-medium whitespace-nowrap ml-1">
                      {event.event_time}
                    </span>
                  )}
                </div>
                {event.description && (
                  <span className="text-[10px] opacity-80 mt-0.5 leading-tight break-words line-clamp-2">
                    {event.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )
    }

    return days
  }

  return (
    <div className="min-h-screen">
      <nav className="glass backdrop-blur-xl shadow-lg border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/app/topics')}
                className="text-slate-300 hover:text-white mr-4 transition-colors"
              >
                ← Dashboard
              </button>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Calendar</h1>
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

      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        <div className="glass backdrop-blur-sm rounded-2xl shadow-lg border border-slate-600/50">
          {/* Calendar Header */}
          <div className="p-4 sm:p-6 border-b border-slate-600/50 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
            <div className="flex items-center justify-between w-full sm:w-auto space-x-2 sm:space-x-4">
              <button
                onClick={goToPreviousMonth}
                className="p-3 sm:p-2 hover:bg-slate-700/50 active:bg-slate-600 rounded-lg text-slate-300 hover:text-white text-xl sm:text-base min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center transition-all active:scale-95"
                aria-label="Previous month"
              >
                ←
              </button>
              <h2 className="text-lg sm:text-2xl font-bold text-white text-center flex-1 sm:flex-none">
                {monthNames[month]} {year}
              </h2>
              <button
                onClick={goToNextMonth}
                className="p-3 sm:p-2 hover:bg-slate-700/50 active:bg-slate-600 rounded-lg text-slate-300 hover:text-white text-xl sm:text-base min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center transition-all active:scale-95"
                aria-label="Next month"
              >
                →
              </button>
            </div>
            <button
              onClick={goToToday}
              className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 active:bg-indigo-700 text-sm font-medium min-h-[44px] sm:min-h-0 transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              Today
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="p-3 sm:p-6">
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <div className="min-w-[560px] sm:min-w-0">
              {/* Day Names Header */}
              <div className="grid grid-cols-7 gap-2.5 sm:gap-3 mb-3 px-2 sm:px-0">
                {dayNames.map((day) => (
                  <div key={day} className="text-center text-xs sm:text-sm font-bold text-slate-300 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-2.5 sm:gap-3 px-2 sm:px-0">
                {renderCalendarDays()}
              </div>
            </div>
            </div>
          </div>
        </div>

        {/* Event Form Modal */}
        {showEventForm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="glass backdrop-blur-xl rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md sm:w-full max-h-[90vh] overflow-y-auto border-t sm:border border-slate-600/50">
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                  <h3 className="text-lg sm:text-xl font-bold text-white">
                    {selectedEvent ? 'Edit Event' : partnerId ? 'New Event' : 'Select a Partner'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowEventForm(false)
                      setSelectedEvent(null)
                      setError(null)
                    }}
                    className="text-slate-400 hover:text-white text-2xl sm:text-xl min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors rounded-lg hover:bg-slate-700/50"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {error && (
                  <div className="mb-4 p-4 bg-red-900/30 border border-red-700/50 rounded-xl">
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                {!selectedEvent && !partnerId && (
                  <div className="mb-4 p-4 bg-yellow-900/30 border border-yellow-700/50 rounded-xl">
                    <p className="text-sm text-yellow-300">
                      Please select a partner from the dashboard to create new events.
                    </p>
                    <button
                      onClick={() => {
                        setShowEventForm(false)
                        navigate('/app/topics')
                      }}
                      className="mt-2 text-sm text-yellow-400 hover:text-yellow-300 underline transition-colors"
                    >
                      Go to Dashboard →
                    </button>
                  </div>
                )}

                <form onSubmit={handleSaveEvent} className="space-y-4 sm:space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      required
                      className="w-full px-4 py-3 text-base border border-slate-600 bg-slate-700/50 text-white placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="Event title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      required
                      className="w-full px-4 py-3 text-base border border-slate-600 bg-slate-700/50 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Time (optional)
                    </label>
                    <input
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      className="w-full px-4 py-3 text-base border border-slate-600 bg-slate-700/50 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Description (optional)
                    </label>
                    <textarea
                      value={eventDescription}
                      onChange={(e) => setEventDescription(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 text-base border border-slate-600 bg-slate-700/50 text-white placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all"
                      placeholder="Event description"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 sm:pt-4">
                    {selectedEvent && (
                      <button
                        type="button"
                        onClick={handleDeleteEvent}
                        className="w-full sm:w-auto px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-500 active:bg-red-700 text-sm font-medium min-h-[44px] order-2 sm:order-1 transition-all shadow-lg hover:shadow-xl active:scale-95"
                      >
                        Delete
                      </button>
                    )}
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto order-1 sm:order-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowEventForm(false)
                          setSelectedEvent(null)
                        }}
                        className="w-full sm:w-auto px-6 py-3 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 active:bg-slate-500 text-sm font-medium min-h-[44px] transition-all active:scale-95"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving || !eventTitle.trim() || !eventDate || (!selectedEvent && !partnerId)}
                        className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium min-h-[44px] transition-all shadow-lg hover:shadow-xl active:scale-95"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
