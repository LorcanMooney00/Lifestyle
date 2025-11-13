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
  'dog-feeding': true,
  'routines': true,
  'show-create-routine': true,
  'notifications': true,
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
      <nav className="glass backdrop-blur-xl shadow-lg border-b border-slate-700/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/app/topics')}
                className="text-slate-300 hover:text-white mr-3 transition-colors text-sm"
              >
                ← Dashboard
              </button>
              <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Settings</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleSignOut}
                className="text-slate-300 hover:text-white p-1.5 rounded-lg transition-all hover:bg-slate-700/50 active:scale-95"
                aria-label="Sign Out"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 pb-20">
        {/* Profile Section */}
        <div className="glass backdrop-blur-xl rounded-xl shadow-xl p-3 border border-slate-700/50">
          <div className="flex items-center space-x-1.5 mb-3">
            <span className="text-base">👤</span>
            <h2 className="text-base font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Profile
            </h2>
          </div>
          
          {pictureError && (
            <div className="mb-2 p-2 bg-red-900/30 border border-red-700/50 rounded-lg">
              <p className="text-[10px] text-red-300">{pictureError}</p>
            </div>
          )}

          {pictureSuccess && (
            <div className="mb-2 p-2 bg-green-900/30 border border-green-700/50 rounded-lg">
              <p className="text-[10px] text-green-300">{pictureSuccess}</p>
            </div>
          )}

          {/* Profile Picture and Username Side by Side */}
          <div className="grid grid-cols-3 gap-3">
            {/* Profile Picture */}
            <div className="col-span-2">
              {!profilePictureUrl && (
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Profile Picture</h3>
              )}
              <div className={`flex items-start gap-3 ${!profilePictureUrl ? '' : 'mt-0'}`}>
                {profilePictureUrl ? (
                  <div className="relative flex-shrink-0">
                    <img
                      src={profilePictureUrl}
                      alt="Profile"
                      className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500/50 shadow-lg"
                    />
                    <button
                      onClick={handleRemoveProfilePicture}
                      disabled={uploadingPicture}
                      className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-600 hover:bg-red-500 text-white text-[10px] flex items-center justify-center transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
                      title="Remove profile picture"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-2 border-slate-600/50 flex items-center justify-center text-xl flex-shrink-0">
                    👤
                  </div>
                )}
                <div className="flex-1 min-w-0">
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
                    className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer mb-1.5 ${
                      uploadingPicture
                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg hover:shadow-xl active:scale-95'
                    }`}
                  >
                    {uploadingPicture ? '⏳ Uploading...' : profilePictureUrl ? '📷 Change' : '➕ Upload'}
                  </label>
                  <p className="text-[9px] text-slate-400">
                    Max 2MB • JPG, PNG, or GIF
                  </p>
                </div>
              </div>
            </div>

            {/* Username */}
            <div>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Username</h3>
              {usernameEditing ? (
                <form onSubmit={handleUpdateUsername} className="space-y-2">
                  {usernameError && (
                    <div className="bg-red-900/30 border border-red-700/50 text-red-300 px-2 py-1.5 rounded-lg">
                      <p className="text-[10px]">{usernameError}</p>
                    </div>
                  )}
                  
                  {usernameSuccess && (
                    <div className="bg-green-900/30 border border-green-700/50 text-green-300 px-2 py-1.5 rounded-lg">
                      <p className="text-[10px]">{usernameSuccess}</p>
                    </div>
                  )}
                  
                  <div>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your username"
                      required
                      className="w-full px-2.5 py-1.5 border border-slate-600/50 bg-slate-800/50 text-slate-100 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-xs"
                      disabled={usernameLoading}
                    />
                  </div>
                  
                  <div className="flex space-x-1.5">
                    <button
                      type="submit"
                      disabled={usernameLoading || !username.trim()}
                      className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-2.5 py-1.5 rounded-lg hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-medium transition-all shadow-lg hover:shadow-xl active:scale-95"
                    >
                      {usernameLoading ? '⏳ Saving...' : '✓ Save'}
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
                      className="px-2.5 py-1.5 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 disabled:opacity-50 text-[10px] font-medium transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col items-start gap-2">
                  <div className="w-full">
                    <p className="text-xs text-slate-200 font-medium truncate">
                      {username || <span className="text-slate-500 italic">Not set</span>}
                    </p>
                    {!username && (
                      <p className="text-[9px] text-slate-400 mt-0.5">
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
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-2.5 py-1 rounded-lg hover:from-indigo-500 hover:to-purple-500 text-[10px] font-medium transition-all shadow-lg hover:shadow-xl active:scale-95"
                  >
                    {username ? '✏️ Edit' : '➕ Add'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dashboard Widgets Section */}
        <div className="glass backdrop-blur-xl rounded-xl shadow-xl p-4 border border-slate-700/50 mt-4">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-lg">🎛️</span>
            <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Dashboard Widgets
            </h2>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Customize which features appear on your dashboard
          </p>

          {tilePreferencesError && (
            <div className="bg-red-900/30 border border-red-700/50 text-red-300 px-3 py-2 rounded-lg mb-3">
              <p className="text-xs">{tilePreferencesError}</p>
            </div>
          )}

          {tilePreferencesSuccess && (
            <div className="bg-green-900/30 border border-green-700/50 text-green-300 px-3 py-2 rounded-lg mb-3">
              <p className="text-xs">{tilePreferencesSuccess}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            {/* Shared Notes Toggle */}
            <div className="flex items-center justify-between bg-slate-800/40 p-2 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-all">
              <p className="font-medium text-slate-200 text-xs">Shared Notes</p>
              <button
                onClick={() => handleToggleTile('shared-notes')}
                disabled={tilePreferencesLoading}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out disabled:opacity-50 ${
                  tilePreferences['shared-notes'] ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                    tilePreferences['shared-notes'] ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Calendar Toggle */}
            <div className="flex items-center justify-between bg-slate-800/40 p-2 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-all">
              <p className="font-medium text-slate-200 text-xs">Calendar</p>
              <button
                onClick={() => handleToggleTile('calendar')}
                disabled={tilePreferencesLoading}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out disabled:opacity-50 ${
                  tilePreferences['calendar'] ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                    tilePreferences['calendar'] ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Recipes Toggle */}
            <div className="flex items-center justify-between bg-slate-800/40 p-2 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-all">
              <p className="font-medium text-slate-200 text-xs">Recipes</p>
              <button
                onClick={() => handleToggleTile('recipes')}
                disabled={tilePreferencesLoading}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out disabled:opacity-50 ${
                  tilePreferences['recipes'] ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                    tilePreferences['recipes'] ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Shared To-Do List Toggle */}
            <div className="flex items-center justify-between bg-slate-800/40 p-2 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-all">
              <p className="font-medium text-slate-200 text-xs">To-Do List</p>
              <button
                onClick={() => handleToggleTile('shared-todos')}
                disabled={tilePreferencesLoading}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out disabled:opacity-50 ${
                  tilePreferences['shared-todos'] ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                    tilePreferences['shared-todos'] ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Shopping List Toggle */}
            <div className="flex items-center justify-between bg-slate-800/40 p-2 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-all">
              <p className="font-medium text-slate-200 text-xs">Shopping List</p>
              <button
                onClick={() => handleToggleTile('shopping-list')}
                disabled={tilePreferencesLoading}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out disabled:opacity-50 ${
                  tilePreferences['shopping-list'] ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                    tilePreferences['shopping-list'] ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Dog Feeding Toggle */}
            <div className="flex items-center justify-between bg-slate-800/40 p-2 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-all">
              <p className="font-medium text-slate-200 text-xs">Dog Feeding</p>
              <button
                onClick={() => handleToggleTile('dog-feeding')}
                disabled={tilePreferencesLoading}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out disabled:opacity-50 ${
                  tilePreferences['dog-feeding'] ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                    tilePreferences['dog-feeding'] ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Photo Gallery Toggle */}
            <div className="flex items-center justify-between bg-slate-800/40 p-2 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-all">
              <p className="font-medium text-slate-200 text-xs">Photo Gallery</p>
              <button
                onClick={() => handleToggleTile('photo-gallery')}
                disabled={tilePreferencesLoading}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out disabled:opacity-50 ${
                  tilePreferences['photo-gallery'] ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                    tilePreferences['photo-gallery'] ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Routines Toggle */}
            <div className="flex items-center justify-between bg-slate-800/40 p-2 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-all">
              <p className="font-medium text-slate-200 text-xs">Daily Routines</p>
              <button
                onClick={() => handleToggleTile('routines')}
                disabled={tilePreferencesLoading}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out disabled:opacity-50 ${
                  tilePreferences['routines'] ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                    tilePreferences['routines'] ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Show Create Routine Section Toggle */}
            <div className="flex items-center justify-between bg-slate-800/40 p-2 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-all">
              <p className="font-medium text-slate-200 text-xs">Show Create Routine Section</p>
              <button
                onClick={() => handleToggleTile('show-create-routine')}
                disabled={tilePreferencesLoading}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out disabled:opacity-50 ${
                  tilePreferences['show-create-routine'] ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                    tilePreferences['show-create-routine'] ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Push Notifications Toggle */}
            <div className="flex items-center justify-between bg-slate-800/40 p-2 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-all">
              <p className="font-medium text-slate-200 text-xs">Push Notifications</p>
              <button
                onClick={() => handleToggleTile('notifications')}
                disabled={tilePreferencesLoading}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out disabled:opacity-50 ${
                  tilePreferences['notifications'] ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                    tilePreferences['notifications'] ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Account Information Section */}
        <div className="glass backdrop-blur-xl rounded-xl shadow-xl p-4 border border-slate-700/50 mt-4">
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-lg">🔐</span>
            <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Account & Security
            </h2>
          </div>

          {/* Email Info */}
          <div className="mb-4 pb-4 border-b border-slate-700/50">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Account Information</h3>
            <div className="bg-slate-800/30 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase">Email</span>
                <span className="text-xs text-slate-200 font-medium">{user?.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase">User ID</span>
                <span className="text-[10px] text-slate-500 font-mono">{user?.id?.slice(0, 8)}...</span>
              </div>
            </div>
          </div>

          {/* Password Change */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Change Password</h3>
          
          {passwordEditing ? (
            <form onSubmit={handleChangePassword} className="space-y-3">
              {passwordError && (
                <div className="bg-red-900/30 border border-red-700/50 text-red-300 px-3 py-2 rounded-lg">
                  <p className="text-xs">{passwordError}</p>
                </div>
              )}
              
              {passwordSuccess && (
                <div className="bg-green-900/30 border border-green-700/50 text-green-300 px-3 py-2 rounded-lg">
                  <p className="text-xs">{passwordSuccess}</p>
                </div>
              )}
              
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-[10px] font-medium text-slate-400 mb-1.5 uppercase tracking-wide"
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
                  className="w-full px-3 py-2 border border-slate-600/50 bg-slate-800/50 text-slate-100 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  disabled={passwordLoading}
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-[10px] font-medium text-slate-400 mb-1.5 uppercase tracking-wide"
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
                  className="w-full px-3 py-2 border border-slate-600/50 bg-slate-800/50 text-slate-100 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  disabled={passwordLoading}
                />
              </div>
              
              <div className="flex space-x-2">
                <button
                  type="submit"
                  disabled={passwordLoading || !newPassword || !confirmPassword}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-3 py-2 rounded-lg hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                  {passwordLoading ? '⏳ Changing...' : '✓ Change Password'}
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
                  className="px-3 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 disabled:opacity-50 text-xs font-medium transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-slate-800/30 rounded-lg p-3">
              <p className="text-xs text-slate-300 mb-2">
                Keep your account secure by regularly updating your password
              </p>
              <button
                onClick={() => {
                  setPasswordEditing(true)
                  setPasswordError(null)
                  setPasswordSuccess(null)
                }}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-3 py-1.5 rounded-lg hover:from-indigo-500 hover:to-purple-500 text-xs font-medium transition-all shadow-lg hover:shadow-xl active:scale-95"
              >
                🔑 Change Password
              </button>
            </div>
          )}
          </div>
        </div>

        {/* Account Deletion Section */}
        <div className="glass backdrop-blur-xl rounded-xl shadow-xl p-4 border border-red-700/50 mt-4">
          <div className="flex items-center space-x-2 mb-4">
            <span className="text-lg">⚠️</span>
            <h2 className="text-lg font-bold bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent">
              Danger Zone
            </h2>
          </div>
          
          {!showDeleteConfirm ? (
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-red-300 mb-1.5">Delete Account</h3>
              <p className="text-xs text-slate-300 mb-1.5">
                Permanently delete your account and all associated data
              </p>
              <p className="text-[10px] text-red-400/80 mb-3">
                ⚠️ This will delete all your notes, events, recipes, and partner links. This action cannot be undone.
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all shadow-lg hover:shadow-xl active:scale-95"
              >
                🗑️ Delete Account
              </button>
            </div>
          ) : (
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-3 space-y-3">
              {deleteError && (
                <div className="bg-red-900/30 border border-red-700/50 text-red-300 px-3 py-2 rounded-lg">
                  <p className="text-xs">{deleteError}</p>
                </div>
              )}
              
              <div>
                <p className="text-xs text-slate-200 mb-2">
                  Type <span className="font-mono font-bold text-red-400 bg-red-950/50 px-1.5 py-0.5 rounded">DELETE</span> to confirm:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="w-full px-3 py-2 border border-red-700/50 bg-slate-900/50 text-slate-100 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all text-sm"
                  disabled={deleting}
                />
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteConfirmText !== 'DELETE'}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white px-3 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                  {deleting ? '⏳ Deleting...' : '🗑️ Permanently Delete'}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteConfirmText('')
                    setDeleteError(null)
                  }}
                  disabled={deleting}
                  className="px-3 py-2 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 disabled:opacity-50 text-xs font-medium transition-all"
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


