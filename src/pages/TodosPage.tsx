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

  const handleCreateTodo = async (content: string) => {
    if (!user) return
    setCreatingTodo(true)
    setTodoError(null)
    try {
      const { todo, error } = await createTodo(user.id, content, partnerId ?? null)
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
      <nav className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate(partnerId ? `/app/partner/${partnerId}` : '/app/topics')}
                className="text-gray-300 hover:text-gray-100"
              >
                ← Back
              </button>
              <h1 className="text-xl font-bold text-gray-100">{pageTitle}</h1>
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
          sharingLabel={
            partnerId
              ? partners.find((p) => p.id === partnerId)?.username ||
                partners.find((p) => p.id === partnerId)?.email ||
                'selected partner'
              : partners.length > 0
              ? 'all linked partners'
              : 'your account'
          }
          onCreate={handleCreateTodo}
          onToggle={handleToggleTodo}
          onDelete={handleDeleteTodo}
        />
      </main>
    </div>
  )
}

