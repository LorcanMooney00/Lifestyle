import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { signOut } from '../lib/auth'
import { getEvents, createEvent, updateEvent, deleteEvent, getPartners } from '../lib/api'
import type { Event, Partner } from '../types'

export default function CalendarPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { partnerId } = useParams<{ partnerId?: string }>()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<Event[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('')
  const [showEventForm, setShowEventForm] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [eventDescription, setEventDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (user) {
      loadEvents()
      loadPartners()
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

  const loadPartners = async () => {
    if (!user) return
    const data = await getPartners(user.id)
    setPartners(data)
  }

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
    // Select the day to show its events
    setSelectedDay(day)
  }
  
  const handleAddEventForDay = () => {
    // Allow creating events from "View All" calendar or partner-specific calendar
    if (selectedDay === null) {
      return
    }
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    setEventDate(dateStr)
    setEventTitle('')
    setEventDescription('')
    setEventTime('')
    setSelectedPartnerId(partnerId || '') // Pre-select partner if viewing partner calendar
    setSelectedEvent(null)
    setError(null)
    setShowEventForm(true)
  }

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !eventTitle.trim() || !eventDate) return

    // Don't allow creating new events without a partner selected
    if (!selectedEvent && !selectedPartnerId) {
      setError('Please select a partner to share this event with')
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
        // Create new event with selected partner
        if (!selectedPartnerId) {
          setSaving(false)
          setError('Please select a partner to share this event with')
          return
        }
        const newEvent = await createEvent(
          eventTitle.trim(),
          eventDescription.trim() || null,
          eventDate,
          eventTime || null,
          user.id,
          selectedPartnerId
        )
        if (newEvent) {
          await loadEvents()
          setShowEventForm(false)
        } else {
          setError('Failed to create event. Please try again.')
        }
      }
    } catch (err) {
      console.error('Error saving event:', err)
      setError('An error occurred while saving the event. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteEvent = () => {
    if (!selectedEvent) return
    setShowDeleteConfirm(true)
  }

  const confirmDelete = async () => {
    if (!selectedEvent) return

    const success = await deleteEvent(selectedEvent.id)
    if (success) {
      await loadEvents()
      setShowEventForm(false)
      setSelectedEvent(null)
      setShowDeleteConfirm(false)
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
        <div key={`empty-${i}`} className="min-h-[75px] sm:min-h-[100px] p-2 rounded-xl bg-slate-900/20 border-2 border-slate-700/20"></div>
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
          className={`min-h-[75px] sm:min-h-[100px] p-2.5 sm:p-3 rounded-xl border-2 flex flex-col transition-all ${
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
          <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
            {dayEvents.map((event) => (
              <div
                key={event.id}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedEvent(event)
                }}
                className="text-[10px] sm:text-xs bg-gradient-to-r from-indigo-600 to-indigo-500 text-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md hover:from-indigo-500 hover:to-indigo-400 active:from-indigo-700 active:to-indigo-600 shadow-sm cursor-pointer transition-all truncate"
                title={event.title + (event.event_time ? ` at ${event.event_time}` : '') + (event.description ? ` - ${event.description}` : '')}
              >
                <span className="font-semibold leading-tight">
                  {event.title}
                  {event.event_time && <span className="opacity-80 ml-1 text-[9px] sm:text-[10px]">@ {event.event_time}</span>}
                </span>
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
                className="text-slate-300 hover:text-white p-2 rounded-lg text-xl transition-all hover:bg-slate-700/50 active:scale-95"
                aria-label="Settings"
              >
                ⚙️
              </button>
              <button
                onClick={handleSignOut}
                className="text-slate-300 hover:text-white p-2 rounded-lg transition-all hover:bg-slate-700/50 active:scale-95"
                aria-label="Sign Out"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
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
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-3 px-2 sm:px-0">
                {dayNames.map((day) => (
                  <div key={day} className="text-center text-xs sm:text-sm font-bold text-slate-300 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 px-2 sm:px-0">
                {renderCalendarDays()}
              </div>
            </div>
            </div>
          </div>
          
          {/* Selected Day Details */}
          {selectedDay !== null && (
            <div className="p-3 sm:p-6 border-t border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-xl">📅</span>
                  {new Date(year, month, selectedDay).toLocaleDateString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </h3>
                <button
                  onClick={handleAddEventForDay}
                  className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-2 text-sm font-medium text-white transition-all hover:from-indigo-500 hover:to-purple-500 shadow-lg hover:shadow-xl active:scale-95"
                >
                  + Add Event
                </button>
              </div>
              
              <div className="space-y-2">
                {getEventsForDay(selectedDay).length === 0 ? (
                  <p className="text-sm text-slate-400 py-4 text-center">
                    No events scheduled for this day
                  </p>
                ) : (
                  getEventsForDay(selectedDay).map((event) => (
                    <div
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className="glass backdrop-blur-xl border border-slate-600/50 rounded-xl p-4 hover:border-indigo-500/50 cursor-pointer transition-all group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-white group-hover:text-indigo-200 transition-colors">
                            {event.title}
                          </h4>
                          {event.event_time && (
                            <p className="text-sm text-indigo-300 mt-1">
                              🕐 {event.event_time}
                            </p>
                          )}
                          {event.description && (
                            <p className="text-sm text-slate-400 mt-2">
                              {event.description}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedEvent(event)
                          }}
                          className="text-slate-400 hover:text-indigo-300 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Event Form Modal */}
        {showEventForm && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="glass backdrop-blur-xl rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-md sm:w-full max-h-[90vh] overflow-y-auto border-t sm:border border-slate-600/50">
              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    {selectedEvent ? 'Edit Event' : 'New Event'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowEventForm(false)
                      setSelectedEvent(null)
                      setError(null)
                    }}
                    className="text-slate-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors rounded-lg hover:bg-slate-700/50"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {error && (
                  <div className="mb-3 p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSaveEvent} className="space-y-3">
                  {/* Partner Selector - only show when creating new event and not in partner-specific calendar */}
                  {!selectedEvent && !partnerId && (
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Share with Partner *
                      </label>
                      <select
                        value={selectedPartnerId}
                        onChange={(e) => setSelectedPartnerId(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-sm border border-slate-600 bg-slate-700/50 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      >
                        <option value="">Select a partner...</option>
                        {partners.map((partner) => (
                          <option key={partner.id} value={partner.id}>
                            {partner.username || partner.email}
                          </option>
                        ))}
                      </select>
                      {partners.length === 0 && (
                        <p className="mt-1.5 text-xs text-slate-400">
                          No partners yet.{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setShowEventForm(false)
                              navigate('/app/topics')
                            }}
                            className="text-indigo-400 hover:text-indigo-300 underline"
                          >
                            Add a partner first →
                          </button>
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm border border-slate-600 bg-slate-700/50 text-white placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      placeholder="Event title"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Date *
                      </label>
                      <input
                        type="date"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-sm border border-slate-600 bg-slate-700/50 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Time
                      </label>
                      <input
                        type="time"
                        value={eventTime}
                        onChange={(e) => setEventTime(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-600 bg-slate-700/50 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      Description
                    </label>
                    <textarea
                      value={eventDescription}
                      onChange={(e) => setEventDescription(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-slate-600 bg-slate-700/50 text-white placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all"
                      placeholder="Event description"
                    />
                  </div>

                  <div className="flex gap-2 pt-3">
                    {selectedEvent && (
                      <button
                        type="button"
                        onClick={handleDeleteEvent}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all active:scale-95"
                        title="Delete event"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setShowEventForm(false)
                        setSelectedEvent(null)
                      }}
                      className="flex-1 px-4 py-2.5 bg-slate-700/50 text-slate-300 hover:text-white rounded-lg hover:bg-slate-700 text-sm font-medium transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving || !eventTitle.trim() || !eventDate || (!selectedEvent && !selectedPartnerId)}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-lg hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-all active:scale-95 shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Save
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass backdrop-blur-xl rounded-xl shadow-2xl w-full max-w-sm border border-slate-600/50">
            <div className="p-5">
              <h3 className="text-lg font-semibold text-white mb-1">Delete "{selectedEvent?.title}"?</h3>
              <p className="text-sm text-slate-400 mb-4">This action cannot be undone.</p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-500 transition-all active:scale-95"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
