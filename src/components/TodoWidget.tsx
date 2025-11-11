import { useState, useMemo } from 'react'
import type { Todo } from '../types'

interface PartnerOption {
  id: string
  email: string
  username: string
  profilePictureUrl?: string | null
}

interface TodoWidgetProps {
  todos: Todo[]
  partners: PartnerOption[]
  groups?: Array<{ id: string; name: string }>
  creating: boolean
  actionIds: string[]
  error: string | null
  onCreate: (content: string) => Promise<void>
  onToggle: (todoId: string, completed: boolean) => Promise<void>
  onDelete: (todoId: string) => Promise<void>
  variant?: 'card' | 'embedded'
  maxItems?: number
  showHeader?: boolean
  className?: string
}

export default function TodoWidget({
  todos,
  partners,
  groups = [],
  creating,
  actionIds,
  error,
  onCreate,
  onToggle,
  onDelete,
  variant = 'card',
  maxItems,
  showHeader,
  className = '',
}: TodoWidgetProps) {
  const [content, setContent] = useState('')

  const groupLookup = useMemo(() => {
    const map = new Map<string, string>()
    groups.forEach((group) => map.set(group.id, group.name))
    return map
  }, [groups])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    await onCreate(content.trim())
    setContent('')
  }

  const isActionPending = (todoId: string) => actionIds.includes(todoId)

  const resolvedShowHeader = showHeader ?? variant === 'card'
  const containerClasses =
    variant === 'card'
      ? `glass backdrop-blur-sm border border-slate-600/40 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col gap-5 w-full ${className}`
      : `flex flex-col gap-4 w-full ${className}`
  const displayedTodos = maxItems ? todos.slice(0, maxItems) : todos

  return (
    <div className={containerClasses}>
      {resolvedShowHeader && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-white">
            <span className="text-xl">✅</span>
            <h3 className="text-lg sm:text-xl font-semibold">Shared To-Do List</h3>
          </div>
          <p className="text-xs text-slate-400">Track tasks in motion together.</p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-700/40 bg-red-900/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a task..."
            className="rounded-xl border border-slate-600/50 bg-slate-800/60 px-4 py-3 text-sm text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 transition-all"
            disabled={creating}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating || !content.trim()}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:bg-indigo-500 hover:shadow-xl active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? 'Adding...' : 'Add Task'}
            </button>
          </div>
        </div>
      </form>

      <div className="flex-1 overflow-y-auto min-h-0">
        {displayedTodos.length === 0 ? (
          <div className="rounded-xl border border-slate-600/40 bg-slate-800/40 px-4 py-6 text-center text-sm text-slate-400">
            No tasks yet. Add your first shared to-do!
          </div>
        ) : (
          <ul className="space-y-2">
            {displayedTodos.map((todo) => {
              const partner = partners.find((p) => p.id === todo.partner_id)
              const groupName = todo.group_id ? groupLookup.get(todo.group_id) : null
              return (
                <li
                  key={todo.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-600/40 bg-slate-800/50 px-4 py-3 text-sm transition-all hover:border-indigo-400/50"
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onToggle(todo.id, !todo.completed)}
                      disabled={isActionPending(todo.id)}
                      className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                        todo.completed
                          ? 'border-green-400 bg-green-500/80 text-white'
                          : 'border-slate-500 bg-slate-800/60 text-slate-300 hover:border-purple-400'
                      } ${isActionPending(todo.id) ? 'opacity-60' : ''}`}
                      aria-label={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
                    >
                      {todo.completed ? '✓' : ''}
                    </button>
                    <div className="min-w-0">
                      <p className={`font-medium text-white ${todo.completed ? 'line-through text-slate-400' : ''}`}>
                        {todo.content}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>
                          Created {new Date(todo.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        {partner && !groupName && (
                          <span className="rounded-md border border-purple-500/25 bg-purple-500/15 px-2 py-0.5 text-purple-200">
                            Shared with {partner.username || partner.email}
                          </span>
                        )}
                        {groupName && (
                          <span className="rounded-md border border-emerald-500/25 bg-emerald-500/15 px-2 py-0.5 text-emerald-200">
                            Group · {groupName}
                          </span>
                        )}
                        {todo.completed && (
                          <span className="rounded-md border border-green-500/25 bg-green-500/15 px-2 py-0.5 text-green-200">
                            Completed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-300">
                    <button
                      type="button"
                      onClick={() => onDelete(todo.id)}
                      disabled={isActionPending(todo.id)}
                      className="rounded-lg bg-red-600/80 px-3 py-1 text-xs font-medium text-white transition-all hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

