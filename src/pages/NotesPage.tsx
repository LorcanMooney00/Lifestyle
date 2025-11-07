import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getAllNotes, createNote, updateNote, deleteNote } from '../lib/api'
import type { Note } from '../types'
import { signOut } from '../lib/auth'

export default function NotesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveTimeout, setSaveTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (user) {
      loadNotes()
    }
  }, [user])

  useEffect(() => {
    if (selectedNote) {
      setNoteTitle(selectedNote.title || '')
      setNoteContent(selectedNote.content || '')
    } else {
      setNoteTitle('')
      setNoteContent('')
    }
  }, [selectedNote])

  const loadNotes = async () => {
    if (!user) return
    setLoading(true)
    const data = await getAllNotes()
    console.log('Loaded notes:', data)
    console.log('User ID:', user.id)
    setNotes(data)
    setLoading(false)
    if (data.length > 0 && !selectedNote) {
      setSelectedNote(data[0])
    }
  }

  const handleContentChange = (value: string) => {
    setNoteContent(value)

    if (saveTimeout) {
      clearTimeout(saveTimeout)
    }

    const timeout = setTimeout(() => {
      if (selectedNote && user) {
        setSaving(true)
        updateNote(selectedNote.id, {
          title: noteTitle || null,
          content: value || null,
        }).then((updated) => {
          if (updated) {
            setSelectedNote(updated)
            setNotes(notes.map((n) => (n.id === updated.id ? updated : n)))
          }
          setSaving(false)
        })
      }
    }, 2000)

    setSaveTimeout(timeout)
  }

  const handleCreateNote = async () => {
    if (!user) return

    const note = await createNote('Untitled Note', '', user.id)
    if (note) {
      await loadNotes()
      setSelectedNote(note)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return

    const success = await deleteNote(noteId)
    if (success) {
      const updatedNotes = notes.filter((n) => n.id !== noteId)
      setNotes(updatedNotes)
      if (selectedNote?.id === noteId) {
        setSelectedNote(updatedNotes.length > 0 ? updatedNotes[0] : null)
      }
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <nav className="bg-white shadow-sm border-b flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/app/topics')}
                className="text-gray-600 hover:text-gray-900 mr-4"
              >
                ← Dashboard
              </button>
              <h1 className="text-xl font-bold text-gray-900">Shared Notes</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/app/settings')}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Settings
              </button>
              {saving && (
                <span className="text-sm text-gray-500">Saving...</span>
              )}
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

      <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full overflow-hidden min-h-0">
        {/* Notes List - Hidden on mobile when note is selected */}
        <div className={`w-full md:w-72 bg-white border-r flex flex-col overflow-hidden shadow-sm ${
          selectedNote ? 'hidden md:flex' : 'flex'
        }`}>
          <div className="p-4 border-b flex justify-between items-center flex-shrink-0 bg-gray-50">
            <h2 className="font-semibold text-gray-900 text-lg">Notes</h2>
            <button
              onClick={handleCreateNote}
              className="bg-indigo-600 text-white px-4 py-1.5 rounded-md text-sm hover:bg-indigo-700 font-medium shadow-sm transition-colors"
            >
              + New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="p-6 text-center text-sm text-gray-500">Loading...</div>
            ) : notes.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-gray-500 mb-4">No notes yet.</p>
                <button
                  onClick={handleCreateNote}
                  className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
                >
                  Create your first note →
                </button>
              </div>
            ) : (
              <div className="p-2">
                {notes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className={`w-full text-left p-3 rounded-lg mb-1 transition-all ${
                      selectedNote?.id === note.id
                        ? 'bg-indigo-100 border border-indigo-300 shadow-sm'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-medium truncate text-sm mb-1 ${
                          selectedNote?.id === note.id ? 'text-indigo-900' : 'text-gray-900'
                        }`}>
                          {note.title || 'Untitled Note'}
                        </h3>
                        {note.content && (
                          <p className={`text-xs truncate mb-1 ${
                            selectedNote?.id === note.id ? 'text-indigo-700' : 'text-gray-600'
                          }`}>
                            {note.content.length > 60 ? `${note.content.substring(0, 60)}...` : note.content}
                          </p>
                        )}
                        <p className={`text-xs ${
                          selectedNote?.id === note.id ? 'text-indigo-600' : 'text-gray-500'
                        }`}>
                          {new Date(note.updated_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteNote(note.id)
                        }}
                        className={`flex-shrink-0 p-1 rounded hover:bg-red-100 transition-colors ${
                          selectedNote?.id === note.id ? 'text-red-600' : 'text-gray-400'
                        }`}
                        title="Delete note"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Note Editor */}
        <div className="flex-1 flex flex-col bg-white">
          {selectedNote ? (
            <>
              <div className="p-4 border-b">
                <div className="flex items-center gap-2 mb-2 md:hidden">
                  <button
                    onClick={() => setSelectedNote(null)}
                    className="text-gray-600 hover:text-gray-900 p-1"
                    aria-label="Back to notes"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <span className="text-sm text-gray-600">Back to Notes</span>
                </div>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => {
                    const newTitle = e.target.value
                    setNoteTitle(newTitle)
                    if (saveTimeout) {
                      clearTimeout(saveTimeout)
                    }
                    const timeout = setTimeout(async () => {
                      if (selectedNote && user) {
                        setSaving(true)
                        // Use the latest state values by reading them in the timeout
                        const currentContent = noteContent
                        const updated = await updateNote(selectedNote.id, {
                          title: newTitle || null,
                          content: currentContent || null,
                        })
                        if (updated) {
                          setSelectedNote(updated)
                          setNotes(notes.map((n) => (n.id === updated.id ? updated : n)))
                        }
                        setSaving(false)
                      }
                    }, 2000)
                    setSaveTimeout(timeout)
                  }}
                  placeholder="Note title"
                  className="w-full text-xl font-semibold border-none focus:outline-none focus:ring-0"
                />
              </div>
              <div className="flex-1 p-4 overflow-y-auto min-h-0">
                <textarea
                  value={noteContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Start writing..."
                  className="w-full h-full border-none focus:outline-none focus:ring-0 resize-none text-gray-900"
                  style={{ minHeight: '400px' }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              {notes.length === 0 ? 'Create your first note to get started!' : 'Select a note to start editing'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
