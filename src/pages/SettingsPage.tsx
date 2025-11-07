import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getPartners, linkPartner, unlinkPartner, getUserProfile, updateUserProfile, getTilePreferences, updateTilePreferences } from '../lib/api'
import { signOut, changePassword, deleteAccount } from '../lib/auth'

export default function SettingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [partnerEmail, setPartnerEmail] = useState('')
  const [partners, setPartners] = useState<Array<{ id: string; email: string; username: string }>>([])
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Username state
  const [username, setUsername] = useState('')
  const [usernameLoading, setUsernameLoading] = useState(false)
  const [usernameEditing, setUsernameEditing] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null)

  // Password change state
  const [passwordEditing, setPasswordEditing] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  // Account deletion state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Tile preferences state
  const [tilePreferences, setTilePreferences] = useState<Record<string, boolean>>({
    'shared-notes': true,
    'calendar': true,
    'recipes': true,
    'photo-gallery': true,
  })
  const [tilePreferencesLoading, setTilePreferencesLoading] = useState(false)
  const [tilePreferencesError, setTilePreferencesError] = useState<string | null>(null)
  const [tilePreferencesSuccess, setTilePreferencesSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadPartnerStatus()
      loadUsername()
      loadTilePreferences()
    }
  }, [user])

  const loadUsername = async () => {
    if (!user) return
    const { username: currentUsername } = await getUserProfile(user.id)
    setUsername(currentUsername || '')
  }

  const loadTilePreferences = async () => {
    if (!user) return
    const { preferences, error } = await getTilePreferences(user.id)
    if (error) {
      setTilePreferencesError(error)
    } else if (preferences) {
      setTilePreferences(preferences)
    }
  }

  const handleToggleTile = async (tileId: string) => {
    if (!user) return

    const oldPreferences = { ...tilePreferences }
    const newPreferences = {
      ...tilePreferences,
      [tileId]: !tilePreferences[tileId],
    }
    
    setTilePreferences(newPreferences)
    setTilePreferencesLoading(true)
    setTilePreferencesError(null)
    setTilePreferencesSuccess(null)

    const { success, error } = await updateTilePreferences(user.id, newPreferences)
    
    if (success) {
      setTilePreferencesSuccess('Preferences updated!')
      setTimeout(() => setTilePreferencesSuccess(null), 3000)
    } else {
      setTilePreferencesError(error || 'Failed to update preferences')
      // Revert on error
      setTilePreferences(oldPreferences)
    }
    
    setTilePreferencesLoading(false)
  }

  const loadPartnerStatus = async () => {
    if (!user) return
    setLoading(true)
    const data = await getPartners(user.id)
    setPartners(data)
    setLoading(false)
  }

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !username.trim()) {
      setUsernameError('Username cannot be empty')
      return
    }

    setUsernameLoading(true)
    setUsernameError(null)
    setUsernameSuccess(null)

    const { success, error } = await updateUserProfile(user.id, username.trim())
    
    if (success) {
      setUsernameSuccess('Username updated successfully!')
      setUsernameEditing(false)
      // Reload partners to show updated username
      await loadPartnerStatus()
    } else {
      setUsernameError(error || 'Failed to update username')
    }

    setUsernameLoading(false)
  }

  const handleLinkPartner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !partnerEmail.trim()) return

    setLinking(true)
    setError(null)
    setSuccess(null)

    const success = await linkPartner(user.id, partnerEmail.trim())
    if (success) {
      setSuccess('Partner linked successfully!')
      setPartnerEmail('')
      await loadPartnerStatus()
    } else {
      setError('Failed to link partner. Make sure they have an account with this email.')
    }

    setLinking(false)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // Validate passwords
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    setPasswordLoading(true)
    setPasswordError(null)
    setPasswordSuccess(null)

    // Note: Supabase doesn't require current password for password change
    // If you want to add that, you'd need to verify it first
    const { success, error } = await changePassword(newPassword)

    if (success) {
      setPasswordSuccess('Password changed successfully!')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordEditing(false)
    } else {
      setPasswordError(error || 'Failed to change password')
    }

    setPasswordLoading(false)
  }

  const handleDeleteAccount = async () => {
    if (!user) return

    // Final confirmation
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm')
      return
    }

    setDeleting(true)
    setDeleteError(null)

    const { success, error } = await deleteAccount()

    if (success) {
      // User will be signed out automatically
      navigate('/login')
    } else {
      setDeleteError(error || 'Failed to delete account. Please try again.')
      setDeleting(false)
    }
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
              <h1 className="text-xl font-bold text-gray-100">Settings</h1>
            </div>
            <div className="flex items-center">
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

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-gray-800 shadow-sm rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-gray-100 mb-6">
            Partner Linking
          </h2>

          {loading ? (
            <div className="text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-6">
              {/* Show existing partners if any */}
              {partners.length > 0 && (
                <div className="space-y-4">
                  <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded">
                    <p className="font-medium">Linked Partners</p>
                    <p className="text-sm mt-1">
                      You have {partners.length} partner{partners.length !== 1 ? 's' : ''} linked.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {partners.map((partner) => (
                      <div
                        key={partner.id}
                        className="flex items-center justify-between bg-gray-700 p-3 rounded border border-gray-600"
                      >
                        <div>
                          <p className="font-medium text-gray-100">{partner.username}</p>
                          <p className="text-sm text-gray-400">{partner.email}</p>
                        </div>
                        <button
                          onClick={async () => {
                            if (!user) return
                            if (confirm(`Are you sure you want to unlink from ${partner.email}?`)) {
                              setUnlinking(true)
                              const success = await unlinkPartner(user.id, partner.id)
                              if (success) {
                                setSuccess('Partner unlinked successfully.')
                                await loadPartnerStatus()
                              } else {
                                setError('Failed to unlink partner. Please try again.')
                              }
                              setUnlinking(false)
                            }
                          }}
                          disabled={unlinking || !user}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-500 disabled:opacity-50"
                        >
                          Unlink
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Always show the form to add more partners */}
              <div className="space-y-4 border-t border-gray-700 pt-6">
                <h3 className="text-lg font-semibold text-gray-100">
                  {partners.length > 0 ? 'Add Another Partner' : 'Link a Partner'}
                </h3>
                <p className="text-gray-400 text-sm">
                  Link your account with a partner's account to share notes and calendar events together.
                  Your partner needs to have an account with the email address you provide.
                </p>

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

                <form onSubmit={handleLinkPartner} className="space-y-4">
                  <div>
                    <label
                      htmlFor="partner-email"
                      className="block text-sm font-medium text-gray-300 mb-2"
                    >
                      Partner's Email Address
                    </label>
                    <input
                      id="partner-email"
                      type="email"
                      value={partnerEmail}
                      onChange={(e) => setPartnerEmail(e.target.value)}
                      placeholder="partner@example.com"
                      required
                      className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={linking || !partnerEmail.trim()}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {linking ? 'Linking...' : 'Link Partner'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-800 shadow-sm rounded-lg p-6 mt-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">
            Username
          </h2>
          
          {usernameEditing ? (
            <form onSubmit={handleUpdateUsername} className="space-y-4">
              {usernameError && (
                <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
                  {usernameError}
                </div>
              )}
              
              {usernameSuccess && (
                <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded">
                  {usernameSuccess}
                </div>
              )}
              
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username"
                  required
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={usernameLoading}
                />
              </div>
              
              <div className="flex space-x-2">
                <button
                  type="submit"
                  disabled={usernameLoading || !username.trim()}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {usernameLoading ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUsernameEditing(false)
                    setUsernameError(null)
                    setUsernameSuccess(null)
                    loadUsername()
                  }}
                  disabled={usernameLoading}
                  className="bg-gray-700 text-gray-300 px-4 py-2 rounded-md hover:bg-gray-600 disabled:opacity-50 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">
                    <span className="font-medium">Username:</span>{' '}
                    {username || (
                      <span className="text-gray-500 italic">Not set</span>
                    )}
                  </p>
                  {!username && (
                    <p className="text-xs text-gray-500 mt-1">
                      Set a username so partners can easily identify you
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setUsernameEditing(true)
                    setUsernameError(null)
                    setUsernameSuccess(null)
                  }}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm font-medium"
                >
                  {username ? 'Change' : 'Add'} Username
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-800 shadow-sm rounded-lg p-6 mt-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">
            Tile Visibility
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Choose which tiles to show on your dashboard
          </p>

          {tilePreferencesError && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded mb-4">
              {tilePreferencesError}
            </div>
          )}

          {tilePreferencesSuccess && (
            <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded mb-4">
              {tilePreferencesSuccess}
            </div>
          )}

          <div className="space-y-4">
            {/* Shared Notes Toggle */}
            <div className="flex items-center justify-between bg-gray-700 p-4 rounded border border-gray-600">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">📝</span>
                <div>
                  <p className="font-medium text-gray-100">Shared Notes</p>
                  <p className="text-sm text-gray-400">Create and share notes with your partner</p>
                </div>
              </div>
              <button
                onClick={() => handleToggleTile('shared-notes')}
                disabled={tilePreferencesLoading}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 ${
                  tilePreferences['shared-notes'] ? 'bg-indigo-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    tilePreferences['shared-notes'] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Calendar Toggle */}
            <div className="flex items-center justify-between bg-gray-700 p-4 rounded border border-gray-600">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">📅</span>
                <div>
                  <p className="font-medium text-gray-100">Calendar</p>
                  <p className="text-sm text-gray-400">Shared calendar and events</p>
                </div>
              </div>
              <button
                onClick={() => handleToggleTile('calendar')}
                disabled={tilePreferencesLoading}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 ${
                  tilePreferences['calendar'] ? 'bg-indigo-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    tilePreferences['calendar'] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Recipes Toggle */}
            <div className="flex items-center justify-between bg-gray-700 p-4 rounded border border-gray-600">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🍳</span>
                <div>
                  <p className="font-medium text-gray-100">Recipes</p>
                  <p className="text-sm text-gray-400">Find recipes based on ingredients you have</p>
                </div>
              </div>
              <button
                onClick={() => handleToggleTile('recipes')}
                disabled={tilePreferencesLoading}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 ${
                  tilePreferences['recipes'] ? 'bg-indigo-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    tilePreferences['recipes'] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Photo Gallery Toggle */}
            <div className="flex items-center justify-between bg-gray-700 p-4 rounded border border-gray-600">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">📸</span>
                <div>
                  <p className="font-medium text-gray-100">Photo Gallery</p>
                  <p className="text-sm text-gray-400">Upload and view your photos</p>
                </div>
              </div>
              <button
                onClick={() => handleToggleTile('photo-gallery')}
                disabled={tilePreferencesLoading}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 ${
                  tilePreferences['photo-gallery'] ? 'bg-indigo-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    tilePreferences['photo-gallery'] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 shadow-sm rounded-lg p-6 mt-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">
            Account Information
          </h2>
          <div className="space-y-2">
            <p className="text-sm text-gray-400">
              <span className="font-medium">Email:</span> {user?.email}
            </p>
            <p className="text-sm text-gray-400">
              <span className="font-medium">User ID:</span> {user?.id}
            </p>
          </div>
        </div>

        {/* Password Change Section */}
        <div className="bg-gray-800 shadow-sm rounded-lg p-6 mt-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">
            Change Password
          </h2>
          
          {passwordEditing ? (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {passwordError && (
                <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
                  {passwordError}
                </div>
              )}
              
              {passwordSuccess && (
                <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded">
                  {passwordSuccess}
                </div>
              )}
              
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={passwordLoading}
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-gray-300 mb-2"
                >
                  Confirm New Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-gray-100 placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={passwordLoading}
                />
              </div>
              
              <div className="flex space-x-2">
                <button
                  type="submit"
                  disabled={passwordLoading || !newPassword || !confirmPassword}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {passwordLoading ? 'Changing...' : 'Change Password'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPasswordEditing(false)
                    setPasswordError(null)
                    setPasswordSuccess(null)
                    setNewPassword('')
                    setConfirmPassword('')
                  }}
                  disabled={passwordLoading}
                  className="bg-gray-700 text-gray-300 px-4 py-2 rounded-md hover:bg-gray-600 disabled:opacity-50 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Change your account password to keep your account secure.
              </p>
              <button
                onClick={() => {
                  setPasswordEditing(true)
                  setPasswordError(null)
                  setPasswordSuccess(null)
                }}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm font-medium"
              >
                Change Password
              </button>
            </div>
          )}
        </div>

        {/* Account Deletion Section */}
        <div className="bg-gray-800 shadow-sm rounded-lg p-6 mt-6 border border-red-700">
          <h2 className="text-xl font-semibold text-red-400 mb-4">
            Delete Account
          </h2>
          
          {!showDeleteConfirm ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <p className="text-xs text-red-400">
                Warning: This will delete all your notes, events, recipes, and partner links.
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-500 text-sm font-medium"
              >
                Delete Account
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {deleteError && (
                <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded">
                  {deleteError}
                </div>
              )}
              
              <div>
                <p className="text-sm text-gray-300 mb-2">
                  Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full px-3 py-2 border border-red-600 bg-gray-700 text-gray-100 placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  disabled={deleting}
                />
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirmText !== 'DELETE'}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {deleting ? 'Deleting...' : 'Permanently Delete Account'}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteConfirmText('')
                    setDeleteError(null)
                  }}
                  disabled={deleting}
                  className="bg-gray-700 text-gray-300 px-4 py-2 rounded-md hover:bg-gray-600 disabled:opacity-50 text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

