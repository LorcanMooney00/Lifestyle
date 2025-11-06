import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getTopics, createTopic } from '../lib/api'
import type { Topic } from '../types'
import { signOut } from '../lib/auth'

export default function TopicsListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [newTopicName, setNewTopicName] = useState('')
  const [showNewTopicForm, setShowNewTopicForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadTopics()
    }
  }, [user])

  const loadTopics = async () => {
    if (!user) return
    setLoading(true)
    const data = await getTopics(user.id)
    setTopics(data)
    setLoading(false)
  }

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !newTopicName.trim()) return

    setCreating(true)
    setError(null)
    
    try {
      const { topic, error: createError } = await createTopic(newTopicName.trim(), user.id)
      if (topic) {
        // Reload topics to ensure we have the latest data
        await loadTopics()
        setNewTopicName('')
        setShowNewTopicForm(false)
      } else {
        setError(createError || 'Failed to create topic. Please try again.')
      }
    } catch (err) {
      console.error('Error creating topic:', err)
      setError(err instanceof Error ? err.message : 'An error occurred while creating the topic.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Topics</h2>
          <button
            onClick={() => setShowNewTopicForm(!showNewTopicForm)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium"
          >
            {showNewTopicForm ? 'Cancel' : '+ New Topic'}
          </button>
        </div>

        {showNewTopicForm && (
          <form
            onSubmit={handleCreateTopic}
            className="mb-6 bg-white p-4 rounded-lg shadow-sm border"
          >
            {error && (
              <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}
            <input
              type="text"
              value={newTopicName}
              onChange={(e) => {
                setNewTopicName(e.target.value)
                setError(null)
              }}
              placeholder="Topic name"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
              autoFocus
              disabled={creating}
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating || !newTopicName.trim()}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {creating ? 'Creating...' : 'Create Topic'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowNewTopicForm(false)
                  setNewTopicName('')
                  setError(null)
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm font-medium"
                disabled={creating}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center text-gray-600 py-12">Loading topics...</div>
        ) : topics.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No topics yet. Create your first topic to get started!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => navigate(`/app/topics/${topic.id}`)}
                className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow text-left"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {topic.name}
                </h3>
                <p className="text-sm text-gray-500">
                  Created {new Date(topic.created_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

