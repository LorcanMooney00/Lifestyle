import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn, signUp, resetPassword } from '../lib/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (isSignUp) {
        if (!username.trim()) {
          setError('Username is required')
          setLoading(false)
          return
        }
        const { error: authError } = await signUp(email, password, username.trim())
        if (authError) {
          setError(authError.message)
        } else {
          navigate('/app/topics')
        }
      } else {
        const { error: authError } = await signIn(email, password)
        if (authError) {
          setError(authError.message)
        } else {
          navigate('/app/topics')
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const { success, error: resetError } = await resetPassword(email)
      if (resetError) {
        setError(resetError)
      } else {
        setSuccess('Password reset email sent! Check your inbox.')
        setEmail('')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8 bg-gray-800 p-8 rounded-lg shadow-md border border-gray-700">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-100">
            {showResetPassword
              ? 'Reset your password'
              : isSignUp
              ? 'Create your account'
              : 'Sign in to your account'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            {showResetPassword
              ? 'Enter your email and we'll send you a reset link'
              : isSignUp
              ? 'Start sharing notes with your partner'
              : 'Welcome back'}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={showResetPassword ? handleResetPassword : handleSubmit}>
          {error && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded">
              {success}
            </div>
          )}
          <div className="rounded-md shadow-sm -space-y-px">
            {isSignUp && !showResetPassword && (
              <div>
                <label htmlFor="username" className="sr-only">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 bg-gray-700 placeholder-gray-400 text-gray-100 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            )}
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 bg-gray-700 placeholder-gray-400 text-gray-100 ${isSignUp && !showResetPassword ? '' : 'rounded-t-md'} focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm`}
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {!showResetPassword && (
              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 bg-gray-700 placeholder-gray-400 text-gray-100 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? 'Please wait...'
                : showResetPassword
                ? 'Send reset link'
                : isSignUp
                ? 'Sign up'
                : 'Sign in'}
            </button>
          </div>

          <div className="text-center space-y-2">
            {!showResetPassword && !isSignUp && (
              <button
                type="button"
                onClick={() => {
                  setShowResetPassword(true)
                  setError(null)
                  setSuccess(null)
                  setPassword('')
                }}
                className="block w-full text-sm text-indigo-400 hover:text-indigo-300"
              >
                Forgot password?
              </button>
            )}
            {showResetPassword ? (
              <button
                type="button"
                onClick={() => {
                  setShowResetPassword(false)
                  setError(null)
                  setSuccess(null)
                }}
                className="text-sm text-indigo-400 hover:text-indigo-300"
              >
                Back to sign in
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError(null)
                  setSuccess(null)
                  setUsername('')
                }}
                className="text-sm text-indigo-400 hover:text-indigo-300"
              >
                {isSignUp
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

