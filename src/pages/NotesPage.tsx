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
    const data = await getAllNotes(user.id)
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white shadow-sm border-b">
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

      <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full">
        {/* Notes List */}
        <div className="w-full md:w-64 bg-white border-r flex flex-col">
          <div className="p-4 border-b flex justify-between items-center">
            <h2 className="font-semibold text-gray-900">Notes</h2>
            <button
              onClick={handleCreateNote}
              className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm hover:bg-indigo-700 font-medium"
            >
              + New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-gray-500">Loading...</div>
            ) : notes.length === 0 ? (
              <div className="p-4 text-sm text-gray-500">
                No notes yet. Create one to get started!
              </div>
            ) : (
              <div className="divide-y">
                {notes.map((note) => (
                  <button
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      selectedNote?.id === note.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate text-sm">
                          {note.title || 'Untitled Note'}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(note.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteNote(note.id)
                        }}
                        className="ml-2 text-red-600 hover:text-red-800 text-xs"
                      >
                        ×
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
              <div className="flex-1 p-4 overflow-y-auto">
                <textarea
                  value={noteContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Start writing..."
                  className="w-full h-full border-none focus:outline-none focus:ring-0 resize-none text-gray-900"
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
