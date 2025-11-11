import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getAllNotes, createNote, updateNote, deleteNote, getPartners } from '../lib/api'
import type { Note, Partner } from '../types'
import { signOut } from '../lib/auth'

export default function NotesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { partnerId } = useParams<{ partnerId?: string }>()
  const [notes, setNotes] = useState<Array<Note & { creator_username?: string | null; partners?: string[] }>>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [selectedNote, setSelectedNote] = useState<(Note & { creator_username?: string | null; partners?: string[] }) | null>(null)
  const [showPartnerSelector, setShowPartnerSelector] = useState(false)
  const [loading, setLoading] = useState(true)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  useEffect(() => {
    if (user) {
      loadNotes()
      loadPartners()
    }
  }, [user, partnerId])

  useEffect(() => {
    if (selectedNote) {
      setNoteTitle(selectedNote.title || '')
      setNoteContent(selectedNote.content || '')
      setHasUnsavedChanges(false)
    } else {
      setNoteTitle('')
      setNoteContent('')
      setHasUnsavedChanges(false)
    }
  }, [selectedNote])

  const loadPartners = async () => {
    if (!user) return
    const data = await getPartners(user.id)
    setPartners(data)
  }

  const loadNotes = async () => {
    if (!user) return
    setLoading(true)
    const data = await getAllNotes(user.id, partnerId || undefined)
    console.log('Loaded notes:', data)
    console.log('User ID:', user.id)
    console.log('Partner ID filter:', partnerId)
    setNotes(data)
    setLoading(false)
    // Don't auto-select any note - let the user choose which one to open
    if (data.length === 0) {
      setSelectedNote(null)
    }
  }

  const handleSaveNote = async () => {
    if (!selectedNote || !user || !hasUnsavedChanges) return

    setSaving(true)
    const updated = await updateNote(selectedNote.id, {
      title: noteTitle || null,
      content: noteContent || null,
    })
    
    if (updated) {
      setSelectedNote(updated)
      setNotes(notes.map((n) => (n.id === updated.id ? updated : n)))
      setHasUnsavedChanges(false)
    }
    setSaving(false)
  }

  const handleDiscardChanges = () => {
    if (!selectedNote) return
    if (!hasUnsavedChanges) return
    setShowDiscardConfirm(true)
  }

  const confirmDiscard = () => {
    if (!selectedNote) return
    setNoteTitle(selectedNote.title || '')
    setNoteContent(selectedNote.content || '')
    setHasUnsavedChanges(false)
    setShowDiscardConfirm(false)
  }

  const handleCreateNote = async (targetPartnerId?: string) => {
    if (!user) return
    
    // If no partnerId in URL and no targetPartnerId provided, show partner selector
    if (!partnerId && !targetPartnerId) {
      setShowPartnerSelector(true)
      return
    }

    const partnerToUse = targetPartnerId || partnerId
    if (!partnerToUse) return

    const note = await createNote('Untitled Note', '', user.id, partnerToUse)
    if (note) {
      await loadNotes()
      setSelectedNote(note)
      setShowPartnerSelector(false)
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
    <div className="h-screen flex flex-col overflow-hidden">
      <nav className="glass backdrop-blur-xl shadow-lg border-b border-slate-700/50 flex-shrink-0 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 gap-3">
            <button
              onClick={() => navigate(partnerId ? `/app/partner/${partnerId}` : '/app/topics')}
              className="text-slate-300 hover:text-white p-2 rounded-lg transition-all hover:bg-slate-700/50 active:scale-95 flex-shrink-0"
              aria-label="Home"
              title={partnerId ? "Partner Workspace" : "Dashboard"}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
            
            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto scrollbar-thin px-2">
              <button
                onClick={() => navigate(partnerId ? `/app/partner/${partnerId}/calendar` : '/app/calendar')}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 text-sm font-medium transition-all whitespace-nowrap flex-shrink-0"
              >
                📅 Calendar
              </button>
              <button
                onClick={() => navigate(partnerId ? `/app/partner/${partnerId}/notes` : '/app/notes')}
                className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-sm font-medium whitespace-nowrap flex-shrink-0"
              >
                📝 Notes
              </button>
              <button
                onClick={() => navigate(partnerId ? `/app/partner/${partnerId}/todos` : '/app/todos')}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 text-sm font-medium transition-all whitespace-nowrap flex-shrink-0"
              >
                ✓ To-Do
              </button>
              <button
                onClick={() => navigate(partnerId ? `/app/partner/${partnerId}/shopping` : '/app/shopping')}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 text-sm font-medium transition-all whitespace-nowrap flex-shrink-0"
              >
                🛒 Shopping
              </button>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {hasUnsavedChanges && (
                <span className="text-xs text-amber-400 flex items-center gap-1">
                  <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                  Unsaved changes
                </span>
              )}
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

      <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full overflow-hidden min-h-0">
        {/* Notes List - Hidden on mobile when note is selected */}
        <div className={`w-full md:w-72 glass backdrop-blur-sm border-r border-slate-600/50 flex flex-col overflow-hidden shadow-lg ${
          selectedNote ? 'hidden md:flex' : 'flex'
        }`}>
          <div className="p-4 border-b border-slate-600/50 flex justify-between items-center flex-shrink-0">
            <h2 className="font-semibold text-white text-lg">Notes</h2>
            <button
              onClick={() => handleCreateNote()}
              className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-500 font-medium shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
              + New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-400">Loading...</div>
            ) : notes.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-slate-400 mb-4">
                  No notes yet. Create one to get started!
                </p>
                <button
                  onClick={() => handleCreateNote()}
                  className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors"
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
                    className={`w-full text-left p-3 rounded-xl mb-2 transition-all card-hover ${
                      selectedNote?.id === note.id
                        ? 'bg-indigo-500/20 border border-indigo-400/50 shadow-lg shadow-indigo-500/20'
                        : 'hover:bg-slate-700/30 border border-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-medium truncate text-sm mb-1 ${
                          selectedNote?.id === note.id ? 'text-indigo-200' : 'text-white'
                        }`}>
                          {note.title || 'Untitled Note'}
                        </h3>
                        {note.content && (
                          <p className={`text-xs truncate mb-1 ${
                            selectedNote?.id === note.id ? 'text-indigo-300' : 'text-slate-400'
                          }`}>
                            {note.content.length > 60 ? `${note.content.substring(0, 60)}...` : note.content}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs ${
                            selectedNote?.id === note.id ? 'text-indigo-400' : 'text-slate-500'
                          }`}>
                            {new Date(note.updated_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </p>
                          {note.partners && note.partners.length > 0 && (
                            <p className={`text-xs truncate ${
                              selectedNote?.id === note.id ? 'text-indigo-400' : 'text-slate-500'
                            }`}>
                              {note.partners.join(' & ')}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteNote(note.id)
                        }}
                        className={`flex-shrink-0 p-1 rounded-lg hover:bg-red-900/50 transition-colors ${
                          selectedNote?.id === note.id ? 'text-red-400' : 'text-slate-500'
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
        <div className="flex-1 flex flex-col">
          {selectedNote ? (
            <>
              <div className="p-4 border-b border-slate-600/50">
                <div className="flex items-center justify-between gap-3 mb-3 md:hidden">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedNote(null)}
                      className="text-slate-300 hover:text-white p-1 transition-colors rounded-lg hover:bg-slate-700/50"
                      aria-label="Back to notes"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-sm text-slate-300">Back to Notes</span>
                  </div>
                  <div className="flex gap-2">
                    {hasUnsavedChanges && (
                      <button
                        onClick={handleDiscardChanges}
                        className="px-3 py-1.5 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg hover:bg-slate-700/50 transition-all"
                      >
                        Discard
                      </button>
                    )}
                    <button
                      onClick={handleSaveNote}
                      disabled={!hasUnsavedChanges || saving}
                      className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl active:scale-95"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => {
                      setNoteTitle(e.target.value)
                      setHasUnsavedChanges(true)
                    }}
                    placeholder="Note title"
                    className="flex-1 min-w-[200px] text-xl font-semibold border-none focus:outline-none focus:ring-0 bg-transparent text-white placeholder-slate-500"
                  />
                  {selectedNote.partners && selectedNote.partners.length > 0 && (
                    <span className="text-sm text-slate-400 whitespace-nowrap">
                      {selectedNote.partners.join(' & ')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 p-4 overflow-y-auto min-h-0">
                <textarea
                  value={noteContent}
                  onChange={(e) => {
                    setNoteContent(e.target.value)
                    setHasUnsavedChanges(true)
                  }}
                  placeholder="Start writing..."
                  className="w-full h-full border-none focus:outline-none focus:ring-0 resize-none text-white bg-transparent placeholder-slate-500"
                  style={{ minHeight: '400px' }}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              {notes.length === 0 
                ? 'Create your first note to get started!'
                : 'Select a note to start editing'}
            </div>
          )}
        </div>
      </div>

      {/* Discard Confirmation Modal */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass backdrop-blur-xl rounded-xl shadow-2xl w-full max-w-sm border border-slate-600/50">
            <div className="p-5">
              <h3 className="text-lg font-semibold text-white mb-1">Discard unsaved changes?</h3>
              <p className="text-sm text-slate-400 mb-4">This action cannot be undone.</p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDiscardConfirm(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDiscard}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-500 transition-all active:scale-95"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Partner Selector Modal */}
      {showPartnerSelector && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md border border-slate-600/50">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">
                  Share Note With
                </h3>
                <button
                  onClick={() => setShowPartnerSelector(false)}
                  className="text-slate-400 hover:text-white text-2xl transition-colors"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {partners.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-400 mb-4">
                    No partners yet. Add a partner first to create shared notes.
                  </p>
                  <button
                    onClick={() => {
                      setShowPartnerSelector(false)
                      navigate('/app/topics')
                    }}
                    className="text-indigo-400 hover:text-indigo-300 underline text-sm"
                  >
                    Go to Dashboard →
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {partners.map((partner) => (
                    <button
                      key={partner.id}
                      onClick={() => handleCreateNote(partner.id)}
                      className="w-full p-4 glass backdrop-blur-xl border border-slate-600/50 rounded-xl hover:border-indigo-500/50 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                          {(partner.username || partner.email || '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-white group-hover:text-indigo-200 transition-colors">
                            {partner.username || partner.email}
                          </p>
                          <p className="text-sm text-slate-400">Create shared note</p>
                        </div>
                        <svg className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
