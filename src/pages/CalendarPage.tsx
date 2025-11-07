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

  useEffect(() => {
    if (user) {
      loadEvents()
    }
  }, [user, currentDate])

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
    const data = await getEvents(firstDay, lastDay)
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
        user.id
      )
      if (newEvent) {
        await loadEvents()
        setShowEventForm(false)
      }
    }
    setSaving(false)
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
        <div key={`empty-${i}`} className="min-h-[70px] sm:min-h-[100px] p-2"></div>
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
          className={`min-h-[70px] sm:min-h-[100px] p-2 border border-gray-700 flex flex-col ${
            isToday ? 'bg-indigo-900/50 border-indigo-500' : 'bg-gray-800/50'
          } ${
            partnerId 
              ? 'hover:bg-gray-700 active:bg-gray-600 cursor-pointer transition-colors' 
              : 'cursor-not-allowed opacity-75'
          }`}
        >
          <div className={`text-base sm:text-lg mb-1 font-semibold ${
            isToday ? 'text-indigo-200' : 'text-gray-200'
          }`}>
            {day}
          </div>
          <div className="flex-1 flex flex-col gap-1 overflow-hidden">
            {dayEvents.slice(0, 3).map((event) => (
              <div
                key={event.id}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedEvent(event)
                }}
                className="text-xs bg-indigo-600 text-white px-2 py-1 rounded-md truncate hover:bg-indigo-500 active:bg-indigo-400 flex flex-col shadow-sm cursor-pointer"
                title={event.title + (event.description ? `: ${event.description}` : '')}
              >
                <span className="font-medium truncate">{event.title}</span>
                {event.description && (
                  <span className="text-[10px] opacity-90 truncate mt-0.5">
                    {event.description.length > 30 ? `${event.description.substring(0, 30)}...` : event.description}
                  </span>
                )}
              </div>
            ))}
            {dayEvents.length > 3 && (
              <div className="text-xs text-indigo-400 px-2 font-medium">
                +{dayEvents.length - 3} more
              </div>
            )}
          </div>
        </div>
      )
    }

    return days
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/app/topics')}
                className="text-gray-300 hover:text-gray-100 mr-4"
              >
                ← Dashboard
              </button>
              <h1 className="text-xl font-bold text-gray-100">Calendar</h1>
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

      <main className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
        <div className="bg-gray-800 rounded-lg shadow-sm border border-gray-700">
          {/* Calendar Header */}
          <div className="p-3 sm:p-6 border-b border-gray-700 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-0">
            <div className="flex items-center justify-between w-full sm:w-auto space-x-2 sm:space-x-4">
              <button
                onClick={goToPreviousMonth}
                className="p-3 sm:p-2 hover:bg-gray-700 active:bg-gray-600 rounded-md text-gray-300 hover:text-gray-100 text-xl sm:text-base min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                aria-label="Previous month"
              >
                ←
              </button>
              <h2 className="text-lg sm:text-2xl font-bold text-gray-100 text-center flex-1 sm:flex-none">
                {monthNames[month]} {year}
              </h2>
              <button
                onClick={goToNextMonth}
                className="p-3 sm:p-2 hover:bg-gray-700 active:bg-gray-600 rounded-md text-gray-300 hover:text-gray-100 text-xl sm:text-base min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center"
                aria-label="Next month"
              >
                →
              </button>
            </div>
            <button
              onClick={goToToday}
              className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 active:bg-indigo-700 text-sm font-medium min-h-[44px] sm:min-h-0"
            >
              Today
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="p-3 sm:p-6">
            {/* Day Names Header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-sm font-bold text-gray-300 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {renderCalendarDays()}
            </div>
          </div>
        </div>

        {/* Event Form Modal */}
        {showEventForm && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-gray-800 rounded-t-xl sm:rounded-lg shadow-xl w-full sm:max-w-md sm:w-full max-h-[90vh] overflow-y-auto border-t sm:border border-gray-700">
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-center mb-4 sm:mb-6">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-100">
                    {selectedEvent ? 'Edit Event' : partnerId ? 'New Event' : 'Select a Partner'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowEventForm(false)
                      setSelectedEvent(null)
                    }}
                    className="text-gray-400 hover:text-gray-200 text-2xl sm:text-xl min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {!selectedEvent && !partnerId && (
                  <div className="mb-4 p-4 bg-yellow-900/20 border border-yellow-700 rounded-md">
                    <p className="text-sm text-yellow-300">
                      Please select a partner from the dashboard to create new events.
                    </p>
                    <button
                      onClick={() => {
                        setShowEventForm(false)
                        navigate('/app/topics')
                      }}
                      className="mt-2 text-sm text-yellow-400 hover:text-yellow-300 underline"
                    >
                      Go to Dashboard →
                    </button>
                  </div>
                )}

                <form onSubmit={handleSaveEvent} className="space-y-4 sm:space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      required
                      className="w-full px-4 py-3 text-base border border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Event title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      required
                      className="w-full px-4 py-3 text-base border border-gray-600 bg-gray-700 text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Time (optional)
                    </label>
                    <input
                      type="time"
                      value={eventTime}
                      onChange={(e) => setEventTime(e.target.value)}
                      className="w-full px-4 py-3 text-base border border-gray-600 bg-gray-700 text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Description (optional)
                    </label>
                    <textarea
                      value={eventDescription}
                      onChange={(e) => setEventDescription(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 text-base border border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      placeholder="Event description"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4 sm:pt-4">
                    {selectedEvent && (
                      <button
                        type="button"
                        onClick={handleDeleteEvent}
                        className="w-full sm:w-auto px-6 py-3 bg-red-600 text-white rounded-md hover:bg-red-500 active:bg-red-700 text-sm font-medium min-h-[44px] order-2 sm:order-1"
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
                        className="w-full sm:w-auto px-6 py-3 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 active:bg-gray-500 text-sm font-medium min-h-[44px]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving || !eventTitle.trim() || !eventDate || (!selectedEvent && !partnerId)}
                        className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium min-h-[44px]"
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
