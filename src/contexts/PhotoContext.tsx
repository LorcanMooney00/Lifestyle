import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { getUserPhotos, getPhotoAssignments } from '../lib/api'
import type { Photo } from '../types'

interface PhotoContextType {
  photos: Photo[]
  photoAssignments: Record<number, string>
  loading: boolean
  refreshPhotos: () => Promise<void>
  refreshAssignments: () => Promise<void>
}

const PhotoContext = createContext<PhotoContextType | undefined>(undefined)

export function PhotoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [photoAssignments, setPhotoAssignments] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [lastLoadTime, setLastLoadTime] = useState<number>(0)

  // Cache photos for 1 hour (same as signed URL expiry)
  const CACHE_DURATION = 60 * 60 * 1000 // 1 hour in milliseconds

  const loadPhotos = async (force = false) => {
    if (!user) {
      setPhotos([])
      setLoading(false)
      return
    }

    // Check cache - signed URLs are valid for 1 hour
    const now = Date.now()
    if (!force && photos.length > 0 && (now - lastLoadTime) < CACHE_DURATION) {
      console.log('Using cached photos (signed URLs still valid)')
      setLoading(false)
      return
    }

    try {
      console.log('Loading photos from API...')
      const photosData = await getUserPhotos(user.id)
      setPhotos(photosData)
      setLastLoadTime(now)
    } catch (error) {
      console.error('Error loading photos:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAssignments = async () => {
    if (!user) {
      setPhotoAssignments({})
      return
    }

    try {
      const assignments = await getPhotoAssignments(user.id)
      // getPhotoAssignments already returns Record<number, string>
      setPhotoAssignments(assignments)
    } catch (error) {
      console.error('Error loading photo assignments:', error)
    }
  }

  useEffect(() => {
    if (user) {
      loadPhotos()
      loadAssignments()
    } else {
      setPhotos([])
      setPhotoAssignments({})
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const refreshPhotos = async () => {
    await loadPhotos(true) // Force reload
  }

  const refreshAssignments = async () => {
    await loadAssignments()
  }

  return (
    <PhotoContext.Provider
      value={{
        photos,
        photoAssignments,
        loading,
        refreshPhotos,
        refreshAssignments,
      }}
    >
      {children}
    </PhotoContext.Provider>
  )
}

export function usePhotos() {
  const context = useContext(PhotoContext)
  if (context === undefined) {
    throw new Error('usePhotos must be used within a PhotoProvider')
  }
  return context
}

