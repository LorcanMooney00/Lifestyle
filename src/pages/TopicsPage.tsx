import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from '../lib/auth'
import { useAuth } from '../lib/auth'
import {
  getAllNotes,
  getEvents,
  getPartners,
  getShoppingItems,
  getTilePreferences,
  linkPartner,
  unlinkPartner,
  getTodos,
  toggleTodoCompletion,
  getDogs,
  createDog,
  updateDog,
  deleteDog,
  uploadDogPhoto,
  getDogMeals,
  toggleDogMeal,
  getGroups,
  createGroup,
  deleteGroup,
} from '../lib/api'
import type { Note, Event, Todo, ShoppingItem, Dog, Group } from '../types'
import PhotoWidget from '../components/PhotoWidget'

const defaultTilePreferences: Record<string, boolean> = {
  'shared-notes': true,
  'calendar': true,
  'recipes': true,
  'photo-gallery': true,
  'shared-todos': true,
  'shopping-list': true,
  'dog-feeding': true,
}

const getTodayKey = () => new Date().toISOString().split('T')[0]

export default function TopicsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>([])
  const [partners, setPartners] = useState<Array<{ id: string; email: string; username: string; profilePictureUrl?: string | null }>>([])
  const [loading, setLoading] = useState(true)
  const [tilePreferences, setTilePreferences] = useState<Record<string, boolean>>(defaultTilePreferences)
  const [todos, setTodos] = useState<Todo[]>([])
  const [todoActionIds, setTodoActionIds] = useState<string[]>([])
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [dogs, setDogs] = useState<Dog[]>([])
  const [showAddDogModal, setShowAddDogModal] = useState(false)
  const [dogModalMode, setDogModalMode] = useState<'add' | 'edit'>('add')
  const [dogFormName, setDogFormName] = useState('')
  const [dogFormMeals, setDogFormMeals] = useState(2)
  const [dogFormWeight, setDogFormWeight] = useState('')
  const [dogFormPhotoUrl, setDogFormPhotoUrl] = useState('')
  const [dogFormPhotoPreviewUrl, setDogFormPhotoPreviewUrl] = useState('')
  const [dogFormPartnerId, setDogFormPartnerId] = useState('')
  const [dogFormPhotoFile, setDogFormPhotoFile] = useState<File | null>(null)
  const [dogSaving, setDogSaving] = useState(false)
  const [dogError, setDogError] = useState<string | null>(null)
  const [dogModalTargetId, setDogModalTargetId] = useState<string | null>(null)
  const contentWidth = 'max-w-5xl mx-auto w-full'
  const [dogMealStatus, setDogMealStatus] = useState<Record<string, { date: string; completed: boolean[] }>>({})
  
  useEffect(() => {
    if (!dogFormPhotoFile) {
      return
    }
    const objectUrl = URL.createObjectURL(dogFormPhotoFile)
    setDogFormPhotoPreviewUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [dogFormPhotoFile])

  const sortDogs = (dogList: Dog[]) =>
    [...dogList].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false)
  const [partnerEmail, setPartnerEmail] = useState('')
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null)
  const [showUnlinkModal, setShowUnlinkModal] = useState(false)
  const [partnerToUnlink, setPartnerToUnlink] = useState<{ id: string; email: string; username: string; profilePictureUrl?: string | null } | null>(null)
  const [unlinking, setUnlinking] = useState(false)
  
  // Groups state
  const [groups, setGroups] = useState<Group[]>([])
  const [showAddGroupModal, setShowAddGroupModal] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [groupError, setGroupError] = useState<string | null>(null)

  const groupLookup = useMemo(() => {
    const map = new Map<string, string>()
    groups.forEach((group) => map.set(group.id, group.name))
    return map
  }, [groups])

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user])

  const loadDashboardData = async () => {
    if (!user) return
    setLoading(true)
    try {
      const today = new Date()
      const nextMonth = new Date(today)
      nextMonth.setDate(today.getDate() + 30)

      const [notesData, partnersData, preferencesData, todosData, eventsData, shoppingData, dogsData, groupsData] = await Promise.all([
        getAllNotes(user.id),
        getPartners(user.id),
        getTilePreferences(user.id),
        getTodos(user.id),
        getEvents(today, nextMonth, undefined, user.id),
        getShoppingItems(user.id),
        getDogs(user.id),
        getGroups(user.id),
      ])

      setNotes(notesData)
      setPartners(partnersData)
      if (preferencesData.preferences) {
        setTilePreferences({ ...defaultTilePreferences, ...preferencesData.preferences })
      } else {
        setTilePreferences(defaultTilePreferences)
      }
      setTodos(todosData)
      setEvents(eventsData)
      setShoppingItems(shoppingData)
      const sortedDogs = sortDogs(dogsData || [])
      setDogs(sortedDogs)
      setGroups(groupsData || [])
      
      // Load dog meals for today
      if (sortedDogs.length > 0) {
        await loadDogMeals(sortedDogs)
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const highlightConfigs = useMemo(() => {
    const configs: Array<{
      type: 'events' | 'notes' | 'todos' | 'shopping'
      title: string
      subtitle: string
      icon: string
      viewAllPath: string
    }> = []

    if (tilePreferences['calendar'] !== false) {
      configs.push({
        type: 'events',
        title: 'Upcoming Events',
        subtitle: 'Stay aligned on what’s next.',
        icon: '📅',
        viewAllPath: '/app/calendar',
      })
    }

    configs.push({
      type: 'notes',
      title: 'Recent Notes',
      subtitle: 'Check the latest shared thoughts.',
      icon: '📝',
      viewAllPath: '/app/notes',
    })

    if (tilePreferences['shared-todos'] !== false) {
      configs.push({
        type: 'todos',
        title: 'Shared To-Do List',
        subtitle: 'Check shared tasks in motion together.',
        icon: '✅',
        viewAllPath: '/app/todos',
      })
    }

    if (tilePreferences['shopping-list'] !== false) {
      configs.push({
        type: 'shopping',
        title: 'Shopping List',
        subtitle: 'Keep your grocery game tight and tidy.',
        icon: '🛒',
        viewAllPath: '/app/shopping',
      })
    }

    return configs
  }, [tilePreferences])

  const partnerMap = useMemo(() => {
    const map = new Map<string, { id: string; email: string; username: string; profilePictureUrl?: string | null }>()
    partners.forEach((partner) => map.set(partner.id, partner))
    return map
  }, [partners])

  useEffect(() => {
    if (dogs.length === 0) {
      setDogMealStatus({})
      return
    }
    // Load meals whenever dogs change
    loadDogMeals(dogs)
  }, [dogs.length])

  const loadDogMeals = async (dogsList: Dog[]) => {
    if (dogsList.length === 0) return
    
    const dogIds = dogsList.map(d => d.id)
    const meals = await getDogMeals(dogIds)
    
    // Convert meals to status format
    const today = getTodayKey()
    const statusByDog: Record<string, { date: string; completed: boolean[] }> = {}
    
    dogsList.forEach(dog => {
      const mealCount = Math.max(1, dog.meals_per_day ?? 2)
      const completedArray = Array(mealCount).fill(false)
      
      meals
        .filter(m => m.dog_id === dog.id)
        .forEach(m => {
          if (m.meal_index < mealCount) {
            completedArray[m.meal_index] = m.completed
          }
        })
      
      statusByDog[dog.id] = {
        date: today,
        completed: completedArray
      }
    })
    
    setDogMealStatus(statusByDog)
  }

  const getMealLabel = (index: number) => {
    if (index === 0) return 'Breakfast'
    if (index === 1) return 'Dinner'
    return `Meal ${index + 1}`
  }

  const handleDogMealAction = async (dog: Dog, mealIndex: number) => {
    if (!user) return
    
    // Optimistically update UI
    const mealCount = Math.max(1, dog.meals_per_day ?? 2)
    setDogMealStatus((prev) => {
      const today = getTodayKey()
      const existing = prev[dog.id]
      const baseCompleted =
        existing && existing.date === today && existing.completed.length === mealCount
          ? [...existing.completed]
          : Array(mealCount).fill(false)
      baseCompleted[mealIndex] = !baseCompleted[mealIndex]
      return {
        ...prev,
        [dog.id]: {
          date: today,
          completed: baseCompleted,
        },
      }
    })
    
    // Update database
    const { error } = await toggleDogMeal(user.id, dog.id, mealIndex)
    
    if (error) {
      console.error('Error toggling dog meal:', error)
      // Reload meals to sync with database
      await loadDogMeals(dogs)
    }
  }

  const openDogModal = (mode: 'add' | 'edit', dog?: Dog) => {
    setDogModalMode(mode)
    setDogError(null)
    if (mode === 'edit' && dog) {
      setDogModalTargetId(dog.id)
      setDogFormName(dog.name)
      setDogFormMeals(dog.meals_per_day ?? 2)
      setDogFormWeight(dog.weight_per_meal != null ? String(dog.weight_per_meal) : '')
      setDogFormPhotoUrl(dog.photo_url ?? '')
      setDogFormPhotoPreviewUrl(
        dog.photo_signed_url ??
          (dog.photo_url && dog.photo_url.startsWith('http') ? dog.photo_url : '')
      )
      setDogFormPartnerId(dog.partner_id ?? '')
      setDogFormPhotoFile(null)
    } else {
      setDogModalTargetId(null)
      setDogFormName('')
      setDogFormMeals(2)
      setDogFormWeight('')
      setDogFormPhotoUrl('')
      setDogFormPartnerId('')
      setDogFormPhotoFile(null)
      setDogFormPhotoPreviewUrl('')
    }
    setShowAddDogModal(true)
  }

  const handleCloseDogModal = () => {
    if (dogSaving) return
    setShowAddDogModal(false)
    setDogFormPhotoFile(null)
    setDogFormPhotoPreviewUrl('')
    setDogModalTargetId(null)
  }

  const handleDogFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const trimmedName = dogFormName.trim()
    if (!trimmedName) {
      setDogError('Please give your dog a name.')
      return
    }

    const weightValue = dogFormWeight.trim() ? Number(dogFormWeight) : null
    if (weightValue !== null && (Number.isNaN(weightValue) || weightValue <= 0)) {
      setDogError('Weight per meal must be a positive number.')
      return
    }

    const mealsValue = Math.max(1, Number(dogFormMeals) || 1)

    setDogSaving(true)
    setDogError(null)

    let photoPath = dogFormPhotoUrl.trim() || null

    if (dogFormPhotoFile) {
      const { path, error: uploadError } = await uploadDogPhoto(dogFormPhotoFile, user.id)
      if (uploadError || !path) {
        setDogError(uploadError || 'Failed to upload photo.')
        setDogSaving(false)
        return
      }
      photoPath = path
      setDogFormPhotoUrl(path)
    }

    if (dogModalMode === 'add') {
      const { dog, error } = await createDog(user.id, {
        name: trimmedName,
        meals_per_day: mealsValue,
        weight_per_meal: weightValue,
        partner_id: dogFormPartnerId || null,
        photo_url: photoPath,
      })

      if (error || !dog) {
        setDogError(error || 'Failed to add dog. Please try again.')
        setDogSaving(false)
        return
      }

      setDogs((prev) => sortDogs([...prev, dog]))
    } else if (dogModalMode === 'edit' && dogModalTargetId) {
      const { dog, error } = await updateDog(dogModalTargetId, {
        name: trimmedName,
        meals_per_day: mealsValue,
        weight_per_meal: weightValue,
        partner_id: dogFormPartnerId || null,
        photo_url: photoPath,
      })

      if (error || !dog) {
        setDogError(error || 'Failed to update dog. Please try again.')
        setDogSaving(false)
        return
      }

      setDogs((prev) =>
        sortDogs(
          prev.map((existing) => (existing.id === dog.id ? dog : existing))
        )
      )
    }

    setShowAddDogModal(false)
    setDogFormPhotoFile(null)
    setDogFormPhotoPreviewUrl('')
    setDogModalTargetId(null)
    setDogSaving(false)
  }

  const handleDeleteDog = async (dogId: string) => {
    if (!user) return
    
    const confirmed = window.confirm('Are you sure you want to remove this dog? This action cannot be undone.')
    if (!confirmed) return

    const { success, error } = await deleteDog(dogId)
    
    if (error || !success) {
      console.error('Error deleting dog:', error)
      alert('Failed to remove dog. Please try again.')
      return
    }

    // Remove from local state
    setDogs((prev) => prev.filter(d => d.id !== dogId))
  }

  useEffect(() => {
    if (highlightIndex >= highlightConfigs.length) {
      setHighlightIndex(0)
    }
  }, [highlightConfigs, highlightIndex])

  useEffect(() => {
    const today = getTodayKey()
    setDogMealStatus((prev) => {
      let changed = false
      const updated: Record<string, { date: string; completed: boolean[] }> = {}

      dogs.forEach((dog) => {
        const mealCount = Math.max(1, dog.meals_per_day ?? 2)
        const existing = prev[dog.id]
        if (existing && existing.date === today && existing.completed.length === mealCount) {
          updated[dog.id] = existing
        } else {
          updated[dog.id] = { date: today, completed: Array(mealCount).fill(false) }
          changed = true
        }
      })

      if (Object.keys(prev).length !== Object.keys(updated).length) {
        changed = true
      }

      return changed ? updated : prev
    })
  }, [dogs])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('dogMealStatus', JSON.stringify(dogMealStatus))
    } catch (error) {
      console.warn('Failed to persist dog meal status:', error)
    }
  }, [dogMealStatus])

  useEffect(() => {
    const now = new Date()
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime()
    const timer = setTimeout(() => {
      setDogMealStatus({})
    }, msUntilMidnight)
    return () => clearTimeout(timer)
  }, [dogs])

  const currentHighlight = highlightConfigs[highlightIndex]

  const handleToggleTodo = async (todoId: string, completed: boolean) => {
    setTodoActionIds((prev) => [...prev, todoId])
    try {
      const { todo, error } = await toggleTodoCompletion(todoId, completed)
      if (error || !todo) {
        return
      }
      setTodos((prev) => prev.map((item) => (item.id === todo.id ? todo : item)))
    } catch (error) {
      console.error('Error toggling todo:', error)
    } finally {
      setTodoActionIds((prev) => prev.filter((id) => id !== todoId))
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const handleLinkPartner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !partnerEmail.trim()) return

    setLinking(true)
    setLinkError(null)
    setLinkSuccess(null)

    const success = await linkPartner(user.id, partnerEmail.trim())
    if (success) {
      setLinkSuccess('Partner linked successfully!')
      setPartnerEmail('')
      await loadDashboardData()
      setTimeout(() => {
        setShowAddPartnerModal(false)
        setLinkSuccess(null)
      }, 1500)
    } else {
      setLinkError('Failed to link partner. Make sure they have an account with this email.')
    }

    setLinking(false)
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !groupName.trim()) return

    setCreatingGroup(true)
    setGroupError(null)

    const newGroup = await createGroup(groupName.trim(), groupDescription.trim() || null, user.id)
    if (newGroup) {
      setGroupName('')
      setGroupDescription('')
      await loadDashboardData()
      setShowAddGroupModal(false)
    } else {
      setGroupError('Failed to create group. Please try again.')
    }

    setCreatingGroup(false)
  }

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!window.confirm(`Delete group "${groupName}"? This cannot be undone.`)) return

    const success = await deleteGroup(groupId)
    if (success) {
      await loadDashboardData()
    }
  }

  const handleOpenAddPartner = () => {
    setShowAddPartnerModal(true)
    setPartnerEmail('')
    setLinkError(null)
    setLinkSuccess(null)
  }

  const handleCloseAddPartner = () => {
    setShowAddPartnerModal(false)
    setPartnerEmail('')
    setLinkError(null)
    setLinkSuccess(null)
  }

  const handleUnlinkPartner = (partner: { id: string; email: string; username: string; profilePictureUrl?: string | null }, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent navigation to partner dashboard
    setPartnerToUnlink(partner)
    setShowUnlinkModal(true)
  }

  const handleConfirmUnlink = async () => {
    if (!user || !partnerToUnlink) return

    setUnlinking(true)
    const success = await unlinkPartner(user.id, partnerToUnlink.id)
    setUnlinking(false)

    if (success) {
      setShowUnlinkModal(false)
      setPartnerToUnlink(null)
      await loadDashboardData()
    } else {
      alert('Failed to unlink partner. Please try again.')
    }
  }

  const handleCancelUnlink = () => {
    setShowUnlinkModal(false)
    setPartnerToUnlink(null)
  }

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.round(diffMs / (1000 * 60))

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`

    const diffHours = Math.round(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`

    const diffDays = Math.round(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }


  return (
    <div className="min-h-screen">
      <nav className="glass backdrop-blur-xl shadow-lg border-b border-slate-700/40 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-300 via-pink-300 to-rose-300 bg-clip-text text-transparent" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Lifestyle
              </h1>
            </div>
            <div className="flex items-center space-x-3">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-20">
        {/* Hero Photo with Integrated Activity Tabs */}
        {!loading && currentHighlight && (
          <div className="mb-6 sm:mb-8">
            <div className={`${contentWidth} space-y-4`}>
              {/* Hero Section with Photo Background */}
              {tilePreferences['photo-gallery'] !== false ? (
                <div className="group/hero relative rounded-2xl overflow-hidden">
                  <PhotoWidget photoIndex={1} wide={true} />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent group-hover/hero:from-slate-950/90 transition-colors duration-300 pointer-events-none"></div>
                  
                  {/* Activity Tabs at Bottom */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 opacity-70 group-hover/hero:opacity-100 transition-opacity duration-300">
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 w-8 rounded-l-2xl bg-gradient-to-r from-slate-950 via-slate-950/60 to-transparent z-10" />
                      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-2xl bg-gradient-to-l from-slate-950 via-slate-950/60 to-transparent z-10" />
                      <div className="scrollbar-none flex snap-x snap-mandatory gap-2 overflow-x-auto p-1">
                  {highlightConfigs.map((config, index) => {
                    const isActive = highlightIndex === index
                    const label =
                      config.type === 'events'
                        ? 'Events'
                        : config.type === 'notes'
                        ? 'Notes'
                        : config.type === 'todos'
                        ? 'To-Dos'
                        : config.type === 'shopping'
                        ? 'Shopping'
                        : config.title

                    return (
                        <button
                          key={config.type}
                          onClick={() => setHighlightIndex(index)}
                          className={`group flex snap-start items-center gap-2 rounded-xl px-4 py-2.5 transition-all backdrop-blur-md ${
                            isActive
                              ? 'bg-white/20 text-white shadow-lg border border-white/30'
                              : 'bg-black/30 text-slate-200 hover:bg-black/40 hover:text-white border border-white/10'
                          }`}
                          aria-pressed={isActive}
                        >
                          <span className="text-lg">{config.icon}</span>
                          <span className="text-xs font-semibold uppercase tracking-wide sm:text-sm whitespace-nowrap">
                            {label}
                          </span>
                        </button>
                      )
                    })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    <span className="text-2xl">✨</span>
                    Recent Activity
                  </h2>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-8 rounded-l-2xl bg-gradient-to-r from-slate-950 via-slate-950/60 to-transparent z-10" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-2xl bg-gradient-to-l from-slate-950 via-slate-950/60 to-transparent z-10" />
                    <div className="scrollbar-none flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-900/80 to-slate-800/60 p-2 text-sm text-slate-300 shadow-xl">
                      {highlightConfigs.map((config, index) => {
                        const isActive = highlightIndex === index
                        const label =
                          config.type === 'events'
                            ? 'Events'
                            : config.type === 'notes'
                            ? 'Notes'
                            : config.type === 'todos'
                            ? 'To-Dos'
                            : config.type === 'shopping'
                            ? 'Shopping'
                            : config.title

                        return (
                          <button
                            key={config.type}
                            onClick={() => setHighlightIndex(index)}
                            className={`group flex snap-start items-center gap-2 rounded-xl px-5 py-2.5 transition-all shadow-lg ${
                              isActive
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-indigo-900/40'
                                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700/80 hover:text-white hover:shadow-xl'
                            }`}
                            aria-pressed={isActive}
                          >
                            <span className="text-lg">{config.icon}</span>
                            <span className="text-xs font-semibold uppercase tracking-wide sm:text-sm whitespace-nowrap">
                              {label}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="glass backdrop-blur-xl border border-slate-600/50 rounded-2xl p-6 sm:p-7 shadow-2xl relative overflow-hidden w-full">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-purple-900/10 to-slate-900/20 pointer-events-none"></div>
                <div className="relative z-10 flex flex-col gap-5 min-h-[420px] sm:min-h-[400px] md:min-h-[440px]">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-700/50">
                    <div>
                      <div className="flex items-center gap-3 text-white">
                        <span className="text-3xl">{currentHighlight.icon}</span>
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">{currentHighlight.title}</h3>
                      </div>
                      <p className="text-sm text-slate-400 mt-2">{currentHighlight.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => navigate(currentHighlight.viewAllPath)}
                        className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:from-indigo-500 hover:to-purple-500 shadow-lg hover:shadow-xl active:scale-95 whitespace-nowrap"
                      >
                        View All →
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 flex-1 overflow-y-auto pr-2 pb-1 max-h-[360px] scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800/50">
                      {currentHighlight.type === 'events' && (
                        <>
                          {events.length === 0 ? (
                            <p className="text-sm text-slate-400">No upcoming events</p>
                          ) : (
                            events
                              .slice()
                              .sort(
                                (a, b) =>
                                  new Date(a.event_date).getTime() -
                                  new Date(b.event_date).getTime()
                              )
                              .map((event) => {
                                const eventDate = new Date(event.event_date)
                                const today = new Date()
                                today.setHours(0, 0, 0, 0)
                                const eventDateOnly = new Date(eventDate)
                                eventDateOnly.setHours(0, 0, 0, 0)
                                const diffTime = eventDateOnly.getTime() - today.getTime()
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                                let timeLabel = ''
                                if (diffDays === 0) {
                                  timeLabel = 'Today'
                                } else if (diffDays === 1) {
                                  timeLabel = 'Tomorrow'
                                } else if (diffDays > 1 && diffDays <= 30) {
                                  timeLabel = `In ${diffDays} days`
                                } else {
                                  timeLabel = eventDate.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                }

                                {
                                  const eventCreator = event.created_by === user?.id 
                                    ? 'You' 
                                    : partners.find(p => p.id === event.created_by)?.username || 
                                      partners.find(p => p.id === event.partner_id)?.username || 
                                      'Unknown'
                                  
                                  const isYourEvent = event.created_by === user?.id
                                  const partnerName = partners.find(p => p.id === event.partner_id)?.username
                                  
                                  return (
                                    <div
                                      key={event.id}
                                      className="rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-3 text-sm text-white transition-colors hover:border-indigo-400/50 cursor-pointer"
                                      onClick={() => navigate('/app/calendar')}
                                    >
                                      <div className="flex items-center justify-between gap-3">
                                        <div className="flex-1 min-w-0 flex items-center gap-3">
                                          <span className="text-lg">📅</span>
                                          <div className="min-w-0">
                                            <p className="font-medium truncate">{event.title}</p>
                                            {event.description && (
                                              <p className="mt-1 text-xs text-slate-400 line-clamp-1">
                                                {event.description}
                                              </p>
                                            )}
                                            <p className="mt-1 text-xs text-slate-500">
                                              {isYourEvent 
                                                ? (partnerName ? `Your calendar with ${partnerName}` : 'Your calendar')
                                                : `${eventCreator}'s calendar`}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1 text-xs text-slate-300 whitespace-nowrap">
                                          {event.event_time && <span>{event.event_time}</span>}
                                          <span className="rounded-md border border-slate-600/50 bg-slate-700/60 px-2 py-0.5">
                                            {timeLabel}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                }
                              })
                          )}
                        </>
                      )}

                      {currentHighlight.type === 'notes' && (
                        <>
                          {notes.length === 0 ? (
                            <p className="text-sm text-slate-400">No recent notes</p>
                          ) : (
                            notes
                              .slice()
                              .sort(
                                (a, b) =>
                                  new Date(b.updated_at).getTime() -
                                  new Date(a.updated_at).getTime()
                              )
                              .map((note) => {
                                const preview =
                                  note.content?.trim().replace(/\s+/g, ' ').slice(0, 140) ||
                                  'No content yet—tap to add your thoughts.'
                                const relativeTime = formatRelativeTime(note.updated_at)
                                const partnerLabel =
                                  note.partners && note.partners.length > 1
                                    ? note.partners.join(' & ')
                                    : null

                                return (
                                  <div
                                    key={note.id}
                                    className="group rounded-2xl border border-slate-700/60 bg-gradient-to-r from-slate-900/85 via-slate-900/70 to-slate-900/40 px-4 py-4 text-sm text-white shadow-lg transition-all hover:-translate-y-0.5 hover:border-indigo-400/60 hover:shadow-indigo-900/30 cursor-pointer"
                                    onClick={() => navigate('/app/notes')}
                                  >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                      <div className="flex flex-1 items-start gap-3">
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-lg text-indigo-200 transition-all group-hover:bg-indigo-500/25">
                                          📝
                                        </div>
                                        <div className="min-w-0 space-y-2">
                                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                            <p className="truncate text-base font-semibold">
                                              {note.title || 'Untitled Note'}
                                            </p>
                                            <span className="flex-shrink-0 text-xs text-indigo-200/80">
                                              {relativeTime}
                                            </span>
                                          </div>
                                          <p className="text-xs text-slate-300 line-clamp-2 break-words">
                                            {preview}
                                            {note.content && note.content.trim().length > 140 && '…'}
                                          </p>
                                          {partnerLabel && (
                                            <div className="flex flex-wrap gap-2 text-[11px] text-indigo-200/80">
                                              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2 py-0.5 uppercase tracking-wide">
                                                {partnerLabel}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })
                          )}
                        </>
                      )}

                      {currentHighlight.type === 'todos' && (
                        <>
                          {todos.filter((todo) => !todo.completed).length === 0 ? (
                            <p className="text-sm text-slate-400">
                              Nothing on your list right now. Add tasks to stay organized!
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {todos
                                .filter((todo) => !todo.completed)
                                .slice(0, 5)
                                .map((todo) => {
                                  const partner = partners.find((p) => p.id === todo.partner_id)
                                  const createdByPartner =
                                    !todo.group_id && todo.user_id !== user?.id
                                      ? partners.find((p) => p.id === todo.user_id)
                                      : undefined
                                  const sharedLabel = todo.group_id
                                    ? `Group · ${groupLookup.get(todo.group_id) || 'Shared'}`
                                    : partner
                                    ? partner.username || partner.email
                                    : createdByPartner
                                    ? createdByPartner.username || createdByPartner.email
                                    : 'Just you'
                                  return (
                                    <div
                                      key={todo.id}
                                      className="flex items-start gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-slate-600/50 transition-colors"
                                    >
                                      <button
                                        onClick={() => handleToggleTodo(todo.id, !todo.completed)}
                                        disabled={todoActionIds.includes(todo.id)}
                                        className="mt-0.5 w-5 h-5 rounded border-2 border-slate-500 hover:border-indigo-400 transition-colors flex items-center justify-center disabled:opacity-50"
                                      >
                                        {todoActionIds.includes(todo.id) && (
                                          <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                        )}
                                      </button>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white">{todo.content}</p>
                                        {sharedLabel && sharedLabel !== 'Just you' && (
                                          <p className="text-xs text-slate-500 mt-1">
                                            Shared with {sharedLabel}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                            </div>
                          )}
                        </>
                      )}

                      {currentHighlight.type === 'shopping' && (
                        <>
                          {shoppingItems.filter((item) => !item.purchased).length === 0 ? (
                            <p className="text-sm text-slate-400">
                              Nothing on your list right now. Add something to keep tabs on it.
                            </p>
                          ) : (
                            shoppingItems
                              .filter((item) => !item.purchased)
                              .slice()
                              .sort(
                                (a, b) =>
                                  new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                              )
                              .map((item) => {
                                const partner =
                                  item.partner_id && partners.find((p) => p.id === item.partner_id)
                                const createdByPartner =
                                  !item.group_id && !partner && item.user_id !== user?.id
                                    ? partners.find((p) => p.id === item.user_id)
                                    : undefined
                                const groupName = item.group_id
                                  ? groupLookup.get(item.group_id)
                                  : null
                                const sharedLabel = groupName
                                  ? `Group · ${groupName || 'Shared'}`
                                  : partner
                                  ? partner.username || partner.email
                                  : createdByPartner
                                  ? createdByPartner.username || createdByPartner.email
                                  : 'Just you'

                                return (
                                  <div
                                    key={item.id}
                                    className="rounded-xl border border-slate-700/60 bg-slate-800/60 px-4 py-3 text-sm text-white transition-colors hover:border-indigo-400/50 cursor-pointer"
                                    onClick={() => navigate('/app/shopping')}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex-1 min-w-0 flex items-center gap-3">
                                        <span className="text-lg">🛒</span>
                                        <div className="min-w-0">
                                          <p className="font-medium truncate">{item.item_name}</p>
                                          {sharedLabel && sharedLabel !== 'Just you' && (
                                            <p className="mt-1 text-xs text-slate-400 line-clamp-1">
                                              Shared with: {sharedLabel}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      {item.quantity && (
                                        <span className="rounded-md border border-indigo-500/30 bg-indigo-500/15 px-2 py-0.5 text-xs text-indigo-200">
                                          {item.quantity}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
            </div>
          </div>
        )}

        {/* Add Dog Modal */}
        {showAddDogModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm p-4 overscroll-contain" onClick={handleCloseDogModal}>
            <div className="flex min-h-full items-center justify-center py-4">
              <div className="glass backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-lg border border-slate-600/50 my-8" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 max-h-[80vh] overflow-y-auto overscroll-contain">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-white">Add Family Dog</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Share feeding details so everyone stays in sync.
                    </p>
                  </div>
                  <button
                    onClick={handleCloseDogModal}
                    className="text-slate-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors rounded-lg hover:bg-slate-700/50"
                    aria-label="Close add dog modal"
                    disabled={dogSaving}
                  >
                    ×
                  </button>
                </div>

                {dogError && (
                  <div className="mb-4 rounded-xl border border-red-700/50 bg-red-900/30 px-4 py-3 text-sm text-red-200">
                    {dogError}
                  </div>
                )}

                <form onSubmit={handleDogFormSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Dog&apos;s Name *
                    </label>
                    <input
                      type="text"
                      value={dogFormName}
                      onChange={(e) => setDogFormName(e.target.value)}
                      placeholder="Buddy"
                      required
                      className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      disabled={dogSaving}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Meals Per Day
                      </label>
                      <select
                        value={dogFormMeals}
                        onChange={(e) => setDogFormMeals(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        disabled={dogSaving}
                      >
                        {[1, 2, 3, 4, 5, 6].map((count) => (
                          <option key={count} value={count}>
                            {count} {count === 1 ? 'meal' : 'meals'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Weight Per Meal (grams)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={dogFormWeight}
                        onChange={(e) => setDogFormWeight(e.target.value)}
                        placeholder="6"
                        className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                        disabled={dogSaving}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Photo URL (optional)
                    </label>
                    <input
                      type="url"
                      value={dogFormPhotoUrl}
                      onChange={(e) => {
                        const value = e.target.value
                        setDogFormPhotoUrl(value)
                        setDogFormPhotoFile(null)
                        setDogFormPhotoPreviewUrl(value && value.startsWith('http') ? value : '')
                      }}
                      placeholder="https://..."
                      className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      disabled={dogSaving}
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Paste an image link or upload a photo below.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Upload Photo
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null
                        setDogFormPhotoFile(file)
                        if (!file) {
                          setDogFormPhotoPreviewUrl(
                            dogFormPhotoUrl && dogFormPhotoUrl.startsWith('http')
                              ? dogFormPhotoUrl
                              : ''
                          )
                        }
                      }}
                      className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      disabled={dogSaving}
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      JPG or PNG up to 5MB. Uploading will replace the current photo.
                    </p>
                    {(dogFormPhotoPreviewUrl || dogFormPhotoUrl) && (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="text-xs text-slate-400">Preview:</div>
                        <div className="h-12 w-12 overflow-hidden rounded-xl border border-slate-600/60">
                          <img
                            src={dogFormPhotoPreviewUrl || dogFormPhotoUrl}
                            alt="Dog preview"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Share with Partner
                    </label>
                    <select
                      value={dogFormPartnerId}
                      onChange={(e) => setDogFormPartnerId(e.target.value)}
                      className="w-full rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      disabled={dogSaving}
                    >
                      <option value="">Just me</option>
                      {partners.map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {partner.username || partner.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleCloseDogModal}
                      className="flex-1 rounded-lg bg-slate-700/70 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-600/80 disabled:opacity-60"
                      disabled={dogSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={dogSaving}
                      className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {dogSaving ? 'Saving...' : dogModalMode === 'add' ? 'Save Dog' : 'Update Dog'}
                    </button>
                  </div>
                </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Partner Selection and Quick Stats with Photo Widget 1 spanning both */}
        {!loading && (
          <div className={`${contentWidth} mb-6 sm:mb-8`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl sm:text-3xl">👥</span>
                Your Partners
              </h2>
              {partners.length > 0 && (
                <span className="text-sm text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                  {partners.length} {partners.length === 1 ? 'Partner' : 'Partners'}
                </span>
              )}
            </div>
            {/* Partners Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 mb-4">
              {partners.map((partner) => (
                  <div
                    key={partner.id}
                    onClick={() => navigate(`/app/partner/${partner.id}`)}
                    className="glass backdrop-blur-xl border border-slate-600/50 p-4 py-3 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 group relative cursor-pointer hover:scale-[1.02] hover:border-indigo-500/50"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
                    {/* Unlink Button - Top Right */}
                    <button
                      onClick={(e) => handleUnlinkPartner(partner, e)}
                      className="absolute top-2 right-2 z-20 p-1 rounded-lg bg-red-600/90 hover:bg-red-500 active:bg-red-700 text-white transition-all shadow-lg hover:shadow-xl opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                      title="Unlink partner"
                      aria-label="Unlink partner"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="relative z-10 flex flex-col items-center text-center">
                      {partner.profilePictureUrl ? (
                        <div className="w-16 h-16 mb-2 rounded-full overflow-hidden border-2 border-indigo-500/50 shadow-lg group-hover:border-indigo-400/70 transition-colors">
                          <img
                            src={partner.profilePictureUrl}
                            alt={partner.username}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 mb-2 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border-2 border-indigo-500/30">
                          <span className="text-3xl">👤</span>
                        </div>
                      )}
                      <h4 className="text-sm font-bold mb-1 text-white group-hover:text-indigo-200 transition-colors line-clamp-1 w-full px-1">
                        {partner.username || partner.email}
                      </h4>
                      {!partner.username && (
                        <div className="h-4"></div>
                      )}
                      <div className="flex items-center gap-1 text-indigo-300 font-medium text-xs group-hover:text-indigo-200 transition-colors">
                        <span>View</span>
                        <span>→</span>
                      </div>
                    </div>
                  </div>
                ))}
              {/* Add Partner Card */}
              <button
                onClick={handleOpenAddPartner}
                className="glass backdrop-blur-xl border-2 border-dashed border-indigo-500/40 p-4 py-3 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 group relative hover:border-indigo-400/60 hover:scale-[1.02]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-16 h-16 mb-2 rounded-full bg-gradient-to-br from-indigo-600/20 to-purple-600/20 flex items-center justify-center group-hover:from-indigo-600/30 group-hover:to-purple-600/30 transition-all border-2 border-indigo-500/30">
                    <span className="text-3xl">➕</span>
                  </div>
                  <h4 className="text-sm font-bold mb-0.5 text-indigo-200 group-hover:text-indigo-100 transition-colors">
                    Add Partner
                  </h4>
                  <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors mb-2">
                    Link new
                  </p>
                </div>
              </button>
            </div>

            {/* Photo Widget - Below Partners */}
            {tilePreferences['photo-gallery'] !== false && (
              <div className="mb-6 sm:mb-8">
                <PhotoWidget photoIndex={0} mediumWide={true} />
              </div>
            )}
          </div>
        )}

        {/* Groups Section */}
        {!loading && (
          <div className={`${contentWidth} mb-6 sm:mb-8`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl sm:text-3xl">👨‍👩‍👧‍👦</span>
                Your Groups
              </h2>
              {groups.length > 0 && (
                <span className="text-sm text-slate-400 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
                  {groups.length} {groups.length === 1 ? 'Group' : 'Groups'}
                </span>
              )}
            </div>
            {/* Groups Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => navigate(`/app/group/${group.id}`)}
                  className="glass backdrop-blur-xl border border-slate-600/50 p-4 py-3 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 group relative cursor-pointer hover:scale-[1.02] hover:border-purple-500/50"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
                  {/* Delete Button - Top Right */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteGroup(group.id, group.name)
                    }}
                    className="absolute top-2 right-2 z-20 p-1 rounded-lg bg-red-600/90 hover:bg-red-500 active:bg-red-700 text-white transition-all shadow-lg hover:shadow-xl opacity-0 group-hover:opacity-100 backdrop-blur-sm"
                    title="Delete group"
                    aria-label="Delete group"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-16 h-16 mb-2 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center border-2 border-purple-500/30">
                      <span className="text-3xl">👥</span>
                    </div>
                    <h4 className="text-sm font-bold mb-1 text-white group-hover:text-purple-200 transition-colors line-clamp-1 w-full px-1">
                      {group.name}
                    </h4>
                    <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors mb-2 line-clamp-1 w-full px-1">
                      {group.member_count || 0} {group.member_count === 1 ? 'member' : 'members'}
                    </p>
                    <div className="flex items-center gap-1 text-purple-300 font-medium text-xs group-hover:text-purple-200 transition-colors">
                      <span>View</span>
                      <span>→</span>
                    </div>
                  </div>
                </div>
              ))}
              {/* Add Group Card */}
              <button
                onClick={() => setShowAddGroupModal(true)}
                className="glass backdrop-blur-xl border-2 border-dashed border-purple-500/40 p-4 py-3 rounded-xl shadow-xl hover:shadow-2xl transition-all duration-300 group relative hover:border-purple-400/60 hover:scale-[1.02]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="w-16 h-16 mb-2 rounded-full bg-gradient-to-br from-purple-600/20 to-pink-600/20 flex items-center justify-center group-hover:from-purple-600/30 group-hover:to-pink-600/30 transition-all border-2 border-purple-500/30">
                    <span className="text-3xl">➕</span>
                  </div>
                  <h4 className="text-sm font-bold mb-0.5 text-purple-200 group-hover:text-purple-100 transition-colors">
                    Create Group
                  </h4>
                  <p className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors mb-2">
                    New group
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Family Dogs Section */}
        {!loading && tilePreferences['dog-feeding'] !== false && (
          <div className={`${contentWidth} mb-6 sm:mb-8`}>
            <div className="glass backdrop-blur-xl rounded-2xl border border-slate-700/50 p-5 sm:p-6 shadow-2xl">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                    <span className="text-2xl">🐕</span>
                    Family Dogs
                  </h3>
                  <p className="text-xs text-slate-400 sm:text-sm mt-1">Track feeding schedules for your pups</p>
                </div>
                <button
                  onClick={() => openDogModal('add')}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-all hover:from-indigo-500 hover:to-purple-500 shadow-lg hover:shadow-xl active:scale-95 whitespace-nowrap"
                >
                  <span>➕</span>
                  <span>Add Dog</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dogs.map((dog) => {
                      const mealCount = Math.max(1, dog.meals_per_day ?? 2)
                      const status = dogMealStatus[dog.id]
                      const completed: boolean[] =
                        status && status.date === getTodayKey() && status.completed.length === mealCount
                          ? [...status.completed]
                          : Array(mealCount).fill(false)
                      const completedCount = completed.filter(Boolean).length
                      const allComplete = completedCount === mealCount

                      return (
                        <div
                          key={dog.id}
                          className={`relative flex flex-col gap-3 rounded-2xl border p-4 shadow-lg transition ${
                            allComplete
                              ? 'border-green-500/40 bg-gradient-to-br from-green-900/30 to-slate-900/70'
                              : 'border-slate-700/60 bg-slate-900/70 hover:border-indigo-400/60'
                          }`}
                        >
                          {/* Header with dog info */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              {dog.photo_signed_url || dog.photo_url ? (
                                <img
                                  src={dog.photo_signed_url || dog.photo_url || ''}
                                  alt={dog.name}
                                  className="h-14 w-14 rounded-xl object-cover border border-indigo-500/30 flex-shrink-0"
                                />
                              ) : (
                                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-xl text-indigo-100 font-bold">
                                  {dog.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0 space-y-1 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-base font-bold text-white">{dog.name}</p>
                                  {allComplete && (
                                    <span className="flex items-center gap-1 rounded-full bg-green-500/20 border border-green-500/40 px-2 py-0.5 text-[10px] font-semibold text-green-200">
                                      ✓ Fed
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                  <span>{completedCount}/{mealCount} meals today</span>
                                  {dog.weight_per_meal && <span>• {dog.weight_per_meal}g each</span>}
                                </div>
                                {dog.partner_id && (
                                  <p className="text-[11px] text-slate-500">
                                    👥 {partnerMap.get(dog.partner_id)?.username || partnerMap.get(dog.partner_id)?.email || 'partner'}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            {/* Action buttons */}
                            <div className="flex gap-1.5 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => openDogModal('edit', dog)}
                                className="rounded-lg border border-indigo-500/40 bg-indigo-500/20 p-1.5 text-indigo-200 transition hover:bg-indigo-500/30 hover:text-indigo-100"
                                title="Edit dog"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDog(dog.id)}
                                className="rounded-lg border border-red-500/40 bg-red-500/20 p-1.5 text-red-200 transition hover:bg-red-500/30 hover:text-red-100"
                                title="Remove dog"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Meals list - always visible */}
                          <div className="space-y-2 pt-2 border-t border-slate-700/50">
                            {Array.from({ length: mealCount }).map((_, mealIndex) => (
                              <label
                                key={mealIndex}
                                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition cursor-pointer ${
                                  completed[mealIndex]
                                    ? 'border-green-500/40 bg-green-900/20 text-green-100'
                                    : 'border-slate-700/50 bg-slate-800/60 text-slate-200 hover:border-indigo-400/60 hover:bg-slate-800/80'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="h-5 w-5 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-indigo-400 focus:ring-offset-slate-900 cursor-pointer"
                                  checked={completed[mealIndex]}
                                  onChange={() => handleDogMealAction(dog, mealIndex)}
                                />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 text-sm font-semibold">
                                    <span className="text-lg">
                                      {mealIndex === 0 ? '🍳' : mealIndex === 1 ? '🍲' : '🥣'}
                                    </span>
                                    <span>{getMealLabel(mealIndex)}</span>
                                  </div>
                                  {dog.weight_per_meal && (
                                    <div className="text-[11px] text-slate-400 ml-7">
                                      {dog.weight_per_meal} g
                                    </div>
                                  )}
                                </div>
                                {completed[mealIndex] && (
                                  <span className="text-green-400 text-sm">✓</span>
                                )}
                              </label>
                            ))}
                          </div>
                        </div>
                      )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Add Partner Modal */}
        {showAddPartnerModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md border border-slate-600/50">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-white">Link a Partner</h3>
                  <button
                    onClick={handleCloseAddPartner}
                    className="text-slate-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors rounded-lg hover:bg-slate-700/50"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {linkError && (
                  <div className="mb-4 p-4 bg-red-900/30 border border-red-700/50 rounded-xl">
                    <p className="text-sm text-red-300">{linkError}</p>
                  </div>
                )}

                {linkSuccess && (
                  <div className="mb-4 p-4 bg-green-900/30 border border-green-700/50 rounded-xl">
                    <p className="text-sm text-green-300">{linkSuccess}</p>
                  </div>
                )}

                <form onSubmit={handleLinkPartner} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Partner's Email Address *
                    </label>
                    <input
                      type="email"
                      value={partnerEmail}
                      onChange={(e) => setPartnerEmail(e.target.value)}
                      placeholder="partner@example.com"
                      required
                      className="w-full px-4 py-3 text-base border border-slate-600 bg-slate-700/50 text-white placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      disabled={linking}
                    />
                    <p className="mt-2 text-xs text-slate-400">
                      Your partner needs to have an account with this email address.
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={handleCloseAddPartner}
                      disabled={linking}
                      className="flex-1 px-6 py-3 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 active:bg-slate-500 text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={linking || !partnerEmail.trim()}
                      className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all shadow-lg hover:shadow-xl active:scale-95"
                    >
                      {linking ? 'Linking...' : 'Link Partner'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Unlink Partner Confirmation Modal */}
        {showUnlinkModal && partnerToUnlink && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md border border-red-600/50">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-1">Unlink Partner?</h3>
                    <p className="text-sm text-slate-400">This action cannot be undone</p>
                  </div>
                  <button
                    onClick={handleCancelUnlink}
                    className="text-slate-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors rounded-lg hover:bg-slate-700/50"
                    aria-label="Close"
                    disabled={unlinking}
                  >
                    ×
                  </button>
                </div>

                <div className="mb-6 p-4 bg-slate-700/30 rounded-xl border border-slate-600/50">
                  <p className="text-sm text-slate-300 mb-2">
                    Are you sure you want to unlink from:
                  </p>
                  <div className="flex items-center gap-3">
                    {partnerToUnlink.profilePictureUrl ? (
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-indigo-500/50 shadow-lg flex-shrink-0">
                        <img
                          src={partnerToUnlink.profilePictureUrl}
                          alt={partnerToUnlink.username}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="text-2xl">👤</div>
                    )}
                    <div>
                      <p className="font-semibold text-white">{partnerToUnlink.username}</p>
                      <p className="text-xs text-slate-400">{partnerToUnlink.email}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-xl">
                  <p className="text-xs text-yellow-300">
                    ⚠️ This will remove all shared access. You'll need to link again to share notes, events, and recipes.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancelUnlink}
                    disabled={unlinking}
                    className="flex-1 px-6 py-3 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 active:bg-slate-500 text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmUnlink}
                    disabled={unlinking}
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-500 active:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all shadow-lg hover:shadow-xl active:scale-95"
                  >
                    {unlinking ? 'Unlinking...' : 'Yes, Unlink'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Group Modal */}
        {showAddGroupModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md border border-slate-600/50">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-white">Create a Group</h3>
                  <button
                    onClick={() => {
                      setShowAddGroupModal(false)
                      setGroupName('')
                      setGroupDescription('')
                      setGroupError(null)
                    }}
                    className="text-slate-400 hover:text-white text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors rounded-lg hover:bg-slate-700/50"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {groupError && (
                  <div className="mb-4 p-4 bg-red-900/30 border border-red-700/50 rounded-xl">
                    <p className="text-sm text-red-300">{groupError}</p>
                  </div>
                )}

                <form onSubmit={handleCreateGroup} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Group Name *
                    </label>
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Family, Friends, Work Team..."
                      required
                      className="w-full px-4 py-3 text-base border border-slate-600 bg-slate-700/50 text-white placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                      disabled={creatingGroup}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={groupDescription}
                      onChange={(e) => setGroupDescription(e.target.value)}
                      placeholder="What's this group for?"
                      rows={3}
                      className="w-full px-4 py-3 text-base border border-slate-600 bg-slate-700/50 text-white placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all resize-none"
                      disabled={creatingGroup}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddGroupModal(false)
                        setGroupName('')
                        setGroupDescription('')
                        setGroupError(null)
                      }}
                      disabled={creatingGroup}
                      className="flex-1 px-6 py-3 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 active:bg-slate-500 text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingGroup || !groupName.trim()}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-500 hover:to-pink-500 active:from-purple-700 active:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-all shadow-lg hover:shadow-xl active:scale-95"
                    >
                      {creatingGroup ? 'Creating...' : 'Create Group'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}

