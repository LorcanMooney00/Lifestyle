import { useState } from 'react'
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
  creating: boolean
  actionIds: string[]
  error: string | null
  sharingLabel: string
  onCreate: (content: string) => Promise<void>
  onToggle: (todoId: string, completed: boolean) => Promise<void>
  onDelete: (todoId: string) => Promise<void>
}

export default function TodoWidget({
  todos,
  partners,
  creating,
  actionIds,
  error,
  sharingLabel,
  onCreate,
  onToggle,
  onDelete,
}: TodoWidgetProps) {
  const [content, setContent] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    await onCreate(content.trim())
    setContent('')
  }

  const isActionPending = (todoId: string) => actionIds.includes(todoId)

  return (
    <div className="glass backdrop-blur-sm border border-slate-600/40 rounded-2xl p-4 sm:p-5 md:p-6 lg:p-5 xl:p-6 2xl:p-5 flex flex-col overflow-hidden shadow-lg min-h-[300px]">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-base sm:text-lg font-bold text-white truncate flex items-center gap-2">
          <span className="text-lg sm:text-xl">✅</span>
          Shared To-Do List
        </h3>
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-red-700/40 bg-red-900/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mb-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a task..."
            className="flex-1 rounded-lg border border-slate-600/50 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 transition-all"
            disabled={creating}
          />
        </div>
        <p className="text-xs text-slate-400">Sharing with {sharingLabel}</p>
        <button
          type="submit"
          disabled={creating || !content.trim()}
          className="w-full sm:w-auto rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition-all hover:bg-indigo-500 hover:shadow-xl active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? 'Adding...' : 'Add Task'}
        </button>
      </form>

      <div className="flex-1 overflow-y-auto min-h-0">
        {todos.length === 0 ? (
          <div className="rounded-xl border border-slate-600/40 bg-slate-800/40 px-4 py-6 text-center text-sm text-slate-400">
            No tasks yet. Add your first shared to-do!
          </div>
        ) : (
          <ul className="space-y-2">
            {todos.map((todo) => {
              const partner = partners.find((p) => p.id === todo.partner_id)
              return (
                <li
                  key={todo.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-600/40 bg-slate-800/40 px-3 py-3 text-sm transition-colors hover:border-slate-500/50"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => onToggle(todo.id, !todo.completed)}
                      disabled={isActionPending(todo.id)}
                      className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                        todo.completed
                          ? 'border-green-400 bg-green-500/80 text-white'
                          : 'border-slate-500 bg-slate-800/60 text-slate-300 hover:border-purple-400'
                      } ${isActionPending(todo.id) ? 'opacity-60' : ''}`}
                      aria-label={todo.completed ? 'Mark as incomplete' : 'Mark as complete'}
                    >
                      {todo.completed ? '✓' : ''}
                    </button>
                    <div className="flex-1">
                      <p className={`font-medium text-white ${todo.completed ? 'line-through text-slate-400' : ''}`}>
                        {todo.content}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                        <span>
                          Created {new Date(todo.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        {partner && (
                          <span className="rounded-md border border-purple-500/25 bg-purple-500/15 px-2 py-0.5 text-purple-200">
                            Shared with {partner.username || partner.email}
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
                  <button
                    type="button"
                    onClick={() => onDelete(todo.id)}
                    disabled={isActionPending(todo.id)}
                    className="rounded-lg bg-red-600/80 px-2 py-1 text-xs font-medium text-white transition-all hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

