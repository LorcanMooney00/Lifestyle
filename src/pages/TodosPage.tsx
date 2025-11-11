import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getTodos, createTodo, toggleTodoCompletion, deleteTodo, getPartners } from '../lib/api'
import type { Todo } from '../types'
import TodoWidget from '../components/TodoWidget'

type PartnerInfo = {
  id: string
  email: string
  username: string
  profilePictureUrl?: string | null
}

export default function TodosPage() {
  const { user } = useAuth()
  const { partnerId } = useParams<{ partnerId?: string }>()
  const navigate = useNavigate()

  const [todos, setTodos] = useState<Todo[]>([])
  const [partners, setPartners] = useState<PartnerInfo[]>([])
  const [creatingTodo, setCreatingTodo] = useState(false)
  const [todoActionIds, setTodoActionIds] = useState<string[]>([])
  const [todoError, setTodoError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPartnerSelector, setShowPartnerSelector] = useState(false)
  const [pendingTodoContent, setPendingTodoContent] = useState('')

  useEffect(() => {
    if (user) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, partnerId])

  const loadData = async () => {
    if (!user) return
    setLoading(true)
    setTodoError(null)
    try {
      const [todosData, partnersData] = await Promise.all([
        getTodos(user.id),
        getPartners(user.id),
      ])
      setTodos(todosData)
      setPartners(partnersData)
    } catch (error) {
      console.error('Error loading todos page:', error)
      setTodoError('Could not load your to-do list. Please try again later.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTodo = async (content: string, targetPartnerId?: string) => {
    if (!user) return
    
    // If no partnerId in URL and no targetPartnerId provided, show partner selector
    if (!partnerId && !targetPartnerId) {
      setPendingTodoContent(content)
      setShowPartnerSelector(true)
      return
    }

    const partnerToUse = targetPartnerId || partnerId
    if (!partnerToUse) return

    setCreatingTodo(true)
    setTodoError(null)
    try {
      const { todo, error } = await createTodo(user.id, content, partnerToUse)
      if (error || !todo) {
        setTodoError(error || 'Failed to create to-do. Please try again.')
        return
      }
      setTodos((prev) => [...prev, todo])
      setShowPartnerSelector(false)
      setPendingTodoContent('')
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

  const displayedTodos = partnerId
    ? todos.filter((todo) => todo.partner_id === partnerId || todo.user_id === partnerId)
    : todos

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-gray-400">Loading shared to-do list...</div>
      </div>
    )
  }

  const pageTitle = partnerId ? 'Shared To-Do List' : 'All Shared To-Dos'

  return (
    <div className="min-h-screen bg-gray-900">
      <nav className="glass backdrop-blur-xl shadow-lg border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3 flex-1 overflow-x-auto scrollbar-thin">
              <button
                onClick={() => navigate(partnerId ? `/app/partner/${partnerId}` : '/app/topics')}
                className="text-slate-300 hover:text-white transition-colors whitespace-nowrap flex-shrink-0"
              >
                ← {partnerId ? 'Back' : 'Dashboard'}
              </button>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => navigate('/app/calendar')}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 text-sm font-medium transition-all whitespace-nowrap"
                >
                  📅 Calendar
                </button>
                <button
                  onClick={() => navigate('/app/notes')}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 text-sm font-medium transition-all whitespace-nowrap"
                >
                  📝 Notes
                </button>
                <button
                  onClick={() => navigate('/app/todos')}
                  className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-sm font-medium whitespace-nowrap"
                >
                  ✓ To-Do
                </button>
                <button
                  onClick={() => navigate('/app/shopping')}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 text-sm font-medium transition-all whitespace-nowrap"
                >
                  🛒 Shopping
                </button>
              </div>
            </div>
            <div className="flex items-center">
              <button
                onClick={() => navigate('/app/settings')}
                className="text-slate-300 hover:text-white p-2 rounded-lg text-xl transition-all hover:bg-slate-700/50 active:scale-95"
                aria-label="Settings"
              >
                ⚙️
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TodoWidget
          todos={displayedTodos}
          partners={partners}
          creating={creatingTodo}
          actionIds={todoActionIds}
          error={todoError}
          onCreate={handleCreateTodo}
          onToggle={handleToggleTodo}
          onDelete={handleDeleteTodo}
        />
      </main>

      {/* Partner Selector Modal */}
      {showPartnerSelector && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md border border-slate-600/50">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">
                  Share To-Do With
                </h3>
                <button
                  onClick={() => {
                    setShowPartnerSelector(false)
                    setPendingTodoContent('')
                  }}
                  className="text-slate-400 hover:text-white text-2xl transition-colors"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {partners.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-400 mb-4">
                    No partners yet. Add a partner first to create shared to-dos.
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
                      onClick={() => handleCreateTodo(pendingTodoContent, partner.id)}
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
                          <p className="text-sm text-slate-400">Create shared to-do</p>
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

