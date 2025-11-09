import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { getUserProfile, updateUserProfile, getTilePreferences, updateTilePreferences, uploadProfilePicture, getProfilePictureUrl } from '../lib/api'
import { signOut, changePassword, deleteAccount } from '../lib/auth'

const defaultTilePreferences: Record<string, boolean> = {
  'shared-notes': true,
  'calendar': true,
  'recipes': true,
  'photo-gallery': true,
  'shared-todos': true,
  'shopping-list': true,
}

export default function SettingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  // Username state
  const [username, setUsername] = useState('')
  const [usernameLoading, setUsernameLoading] = useState(false)
  const [usernameEditing, setUsernameEditing] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null)

  // Profile picture state
  // Store the storage path (not signed URL) so it doesn't expire
  const [profilePicturePath, setProfilePicturePath] = useState<string | null>(null)
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null) // Signed URL for display
  const [uploadingPicture, setUploadingPicture] = useState(false)
  const [pictureError, setPictureError] = useState<string | null>(null)
  const [pictureSuccess, setPictureSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  const [tilePreferences, setTilePreferences] = useState<Record<string, boolean>>(defaultTilePreferences)
  const [tilePreferencesLoading, setTilePreferencesLoading] = useState(false)
  const [tilePreferencesError, setTilePreferencesError] = useState<string | null>(null)
  const [tilePreferencesSuccess, setTilePreferencesSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      loadUsername()
      loadTilePreferences()
    }
  }, [user])

  const loadUsername = async () => {
    if (!user) return
    console.log('=== SettingsPage: Loading Username ===')
    const { username: currentUsername, profilePictureUrl } = await getUserProfile(user.id)
    console.log('Loaded username:', currentUsername)
    console.log('Loaded profile picture URL from DB:', profilePictureUrl)
    setUsername(currentUsername || '')
    // Store the storage path (not the signed URL) so it doesn't expire
    if (profilePictureUrl) {
      console.log('Storing profile picture path:', profilePictureUrl)
      setProfilePicturePath(profilePictureUrl)
    } else {
      console.log('No profile picture URL found')
      setProfilePicturePath(null)
    }
    console.log('=== END SettingsPage: Loading Username ===')
  }

  // Convert storage path to signed URL when it changes
  useEffect(() => {
    const convertToSignedUrl = async () => {
      if (profilePicturePath) {
        console.log('Converting profile picture path to signed URL:', profilePicturePath)
        const signedUrl = await getProfilePictureUrl(profilePicturePath)
        console.log('Generated signed URL:', signedUrl)
        setProfilePictureUrl(signedUrl)
      } else {
        setProfilePictureUrl(null)
      }
    }
    convertToSignedUrl()
  }, [profilePicturePath])

  const loadTilePreferences = async () => {
    if (!user) return
    const { preferences, error } = await getTilePreferences(user.id)
    if (error) {
      setTilePreferencesError(error)
    } else if (preferences) {
      setTilePreferences({ ...defaultTilePreferences, ...preferences })
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

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !username.trim()) {
      setUsernameError('Username cannot be empty')
      return
    }

    setUsernameLoading(true)
    setUsernameError(null)
    setUsernameSuccess(null)

    const { success, error } = await updateUserProfile(user.id, username.trim(), profilePicturePath)
    
    if (success) {
      setUsernameSuccess('Username updated successfully!')
      setUsernameEditing(false)
    } else {
      setUsernameError(error || 'Failed to update username')
    }

    setUsernameLoading(false)
  }

  const handleProfilePictureSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setPictureError('Please select an image file')
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setPictureError('Profile picture size must be less than 2MB')
      return
    }

    setUploadingPicture(true)
    setPictureError(null)
    setPictureSuccess(null)

    console.log('=== SettingsPage: Profile Picture Upload ===')
    const { url, error: uploadError } = await uploadProfilePicture(file)
    console.log('Upload result - URL:', url)
    console.log('Upload result - Error:', uploadError)

    if (uploadError) {
      setPictureError(uploadError)
    } else if (url) {
      // url is the storage path (not a signed URL)
      // Store the storage path - useEffect will convert it to signed URL
      console.log('Setting profile picture path (storage path):', url)
      setProfilePicturePath(url) // Store storage path - useEffect will generate signed URL
      setPictureSuccess('Profile picture updated successfully!')
      setTimeout(() => setPictureSuccess(null), 3000)
    }
    console.log('=== END SettingsPage: Profile Picture Upload ===')

    setUploadingPicture(false)
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveProfilePicture = async () => {
    if (!user) return

    setUploadingPicture(true)
    setPictureError(null)
    setPictureSuccess(null)

    const { success, error } = await updateUserProfile(user.id, username, null)
    
    if (success) {
      setProfilePicturePath(null) // Clear storage path - useEffect will clear signed URL
      setPictureSuccess('Profile picture removed successfully!')
      setTimeout(() => setPictureSuccess(null), 3000)
    } else {
      setPictureError(error || 'Failed to remove profile picture')
    }

    setUploadingPicture(false)
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
        <div className="bg-gray-800 shadow-sm rounded-lg p-6 mt-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">
            Profile Picture
          </h2>
          
          {pictureError && (
            <div className="mb-4 p-4 bg-red-900/30 border border-red-700/50 rounded-xl">
              <p className="text-sm text-red-300">{pictureError}</p>
            </div>
          )}

          {pictureSuccess && (
            <div className="mb-4 p-4 bg-green-900/30 border border-green-700/50 rounded-xl">
              <p className="text-sm text-green-300">{pictureSuccess}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              {profilePictureUrl ? (
                <div className="relative">
                  <img
                    src={profilePictureUrl}
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover border-2 border-indigo-500/50 shadow-lg"
                  />
                  <button
                    onClick={handleRemoveProfilePicture}
                    disabled={uploadingPicture}
                    className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs flex items-center justify-center transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                    title="Remove profile picture"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-full bg-slate-700/50 border-2 border-slate-600/50 flex items-center justify-center text-3xl">
                  👤
                </div>
              )}
              <div className="flex-1">
                <p className="text-sm text-slate-300 mb-2">
                  {profilePictureUrl ? 'Your profile picture' : 'No profile picture set'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureSelect}
                  className="hidden"
                  id="profile-picture-upload"
                  disabled={uploadingPicture}
                />
                <label
                  htmlFor="profile-picture-upload"
                  className={`inline-block px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                    uploadingPicture
                      ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 shadow-lg hover:shadow-xl active:scale-95'
                  }`}
                >
                  {uploadingPicture ? 'Uploading...' : profilePictureUrl ? 'Change Picture' : 'Upload Picture'}
                </label>
                <p className="text-xs text-slate-400 mt-2">
                  Max 2MB. JPG, PNG, or GIF.
                </p>
              </div>
            </div>
          </div>
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
            Dashboard Preferences
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Choose which tiles to show on your partner dashboards
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

            {/* Shared To-Do List Toggle */}
            <div className="flex items-center justify-between bg-gray-700 p-4 rounded border border-gray-600">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-medium text-gray-100">Shared To-Do List</p>
                  <p className="text-sm text-gray-400">Track shared tasks with your partners</p>
                </div>
              </div>
              <button
                onClick={() => handleToggleTile('shared-todos')}
                disabled={tilePreferencesLoading}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 ${
                  tilePreferences['shared-todos'] ? 'bg-indigo-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    tilePreferences['shared-todos'] ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Shopping List Toggle */}
            <div className="flex items-center justify-between bg-gray-700 p-4 rounded border border-gray-600">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🛒</span>
                <div>
                  <p className="font-medium text-gray-100">Shopping List</p>
                  <p className="text-sm text-gray-400">Keep a shared list of groceries and essentials</p>
                </div>
              </div>
              <button
                onClick={() => handleToggleTile('shopping-list')}
                disabled={tilePreferencesLoading}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 ${
                  tilePreferences['shopping-list'] ? 'bg-indigo-600' : 'bg-gray-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    tilePreferences['shopping-list'] ? 'translate-x-5' : 'translate-x-0'
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
                  <p className="text-sm text-gray-400">Upload and view your photos on the main dashboard</p>
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


