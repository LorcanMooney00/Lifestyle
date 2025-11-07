import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { getUserPhotos, uploadPhoto, deletePhoto } from '../lib/api'
import type { Photo } from '../types'

interface PhotoWidgetProps {
  photoIndex?: number // Which photo to show (0, 1, 2, etc.)
  tall?: boolean // If true, widget will be taller (2:1 aspect ratio instead of 1:1)
  fillHeight?: boolean // If true, widget will fill available height instead of using aspect ratio
  wide?: boolean // If true, widget will be wide banner format (4:1 aspect ratio)
}

export default function PhotoWidget({ photoIndex = 0, tall = false, fillHeight = false, wide = false }: PhotoWidgetProps) {
  const { user } = useAuth()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) {
      loadPhotos()
    }
  }, [user])

  const loadPhotos = async () => {
    if (!user) return
    const photosData = await getUserPhotos(user.id)
    setPhotos(photosData)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB')
      return
    }

    setUploading(true)
    setError(null)

    const { photo, error: uploadError } = await uploadPhoto(file)

    if (uploadError) {
      setError(uploadError)
    } else if (photo) {
      // Store which photo is assigned to this widget
      const widgetKey = `photo-widget-${photoIndex}`
      localStorage.setItem(widgetKey, photo.id)
      await loadPhotos()
      setShowUpload(false)
    }

    setUploading(false)
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (photo: Photo) => {
    if (!user || !confirm('Are you sure you want to delete this photo?')) return

    const { error: deleteError } = await deletePhoto(photo.id, photo.storage_path)

    if (deleteError) {
      setError(deleteError)
    } else {
      // Clear the assignment if this photo was assigned to this widget
      const widgetKey = `photo-widget-${photoIndex}`
      const assignedPhotoId = localStorage.getItem(widgetKey)
      if (assignedPhotoId === photo.id) {
        localStorage.removeItem(widgetKey)
      }
      await loadPhotos()
    }
  }

  // Get the photo to display - each widget shows a specific photo based on localStorage assignment
  // If a photo is assigned to this widget, show it. Otherwise, show the photo at the photoIndex position
  const getDisplayPhoto = () => {
    const widgetKey = `photo-widget-${photoIndex}`
    const assignedPhotoId = localStorage.getItem(widgetKey)
    
    if (assignedPhotoId) {
      // Find the photo with this ID
      const assignedPhoto = photos.find(p => p.id === assignedPhotoId)
      if (assignedPhoto) {
        return assignedPhoto
      }
      // If assigned photo doesn't exist anymore (was deleted), clear the assignment
      localStorage.removeItem(widgetKey)
    }
    
    // Fallback to showing photo at photoIndex position
    return photos.length > photoIndex ? photos[photoIndex] : null
  }
  
  const displayPhoto = getDisplayPhoto()

  // For wide banners, use responsive aspect ratios
  const aspectClass = fillHeight 
    ? 'h-full' 
    : (wide 
      ? 'aspect-[3/1] sm:aspect-[4/1] lg:aspect-[5/1]' 
      : (tall 
        ? 'aspect-[2/1]' 
        : 'aspect-square'))

  if (photos.length === 0 && !showUpload) {
    return (
      <div className={`bg-transparent border-0 rounded-xl p-3 sm:p-4 ${aspectClass} flex flex-col items-center justify-center overflow-hidden`}>
        <div className="text-3xl sm:text-4xl mb-2">📸</div>
        <button
          onClick={() => setShowUpload(true)}
          className="bg-indigo-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-indigo-500 text-xs sm:text-sm font-medium transition-colors shadow-md hover:shadow-lg active:scale-95 touch-manipulation"
        >
          Upload
        </button>
      </div>
    )
  }

  return (
    <div className={`bg-transparent border-0 rounded-xl overflow-hidden ${aspectClass} flex flex-col group relative w-full`}>

      {/* Regular header when upload is shown */}
      {showUpload && (
        <div className="p-2 sm:p-3 border-b border-slate-600/20">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-gray-100">Photo</h3>
            <button
              onClick={() => setShowUpload(false)}
              className="bg-indigo-600 text-white px-2 sm:px-3 py-1 rounded-lg hover:bg-indigo-500 text-xs sm:text-sm font-medium transition-colors shadow-md hover:shadow-lg active:scale-95 touch-manipulation"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border-b border-red-700/30 text-red-200 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
          {error}
        </div>
      )}

      {showUpload && (
        <div className="p-3 sm:p-4 bg-slate-800/50 flex-1 flex flex-col justify-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id={`photo-upload-${photoIndex}`}
          />
          <label
            htmlFor={`photo-upload-${photoIndex}`}
            className={`block text-center py-3 sm:py-4 px-3 sm:px-4 border-2 border-dashed rounded-lg cursor-pointer transition-all touch-manipulation min-h-[60px] flex items-center justify-center ${
              uploading
                ? 'border-slate-500/50 bg-slate-600/30'
                : 'border-purple-400/30 bg-slate-700/20 hover:border-purple-300/40 hover:bg-slate-600/20 active:bg-slate-600/30'
            }`}
          >
            {uploading ? (
              <span className="text-gray-300 text-xs sm:text-sm">Uploading...</span>
            ) : (
              <span className="text-indigo-400 font-medium text-xs sm:text-sm">Click to select an image</span>
            )}
          </label>
          <p className="text-xs text-gray-400 mt-2 text-center">Max 5MB, images only</p>
        </div>
      )}

      {displayPhoto && (
        <div className="flex-1 relative overflow-hidden w-full h-full group rounded-xl">
          <img
            src={displayPhoto.url}
            alt={`Photo ${photoIndex + 1}`}
            className="w-full h-full object-cover rounded-xl"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-transparent pointer-events-none rounded-xl"></div>
          <div className="absolute inset-0 bg-slate-900/10 pointer-events-none rounded-xl"></div>

          {/* Delete button - bottom right, hidden until hover */}
          <button
            onClick={() => handleDelete(displayPhoto)}
            className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 bg-red-600/80 hover:bg-red-600 active:bg-red-700 text-white p-2 sm:p-2.5 rounded-full transition-all shadow-lg backdrop-blur-md touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center text-xs sm:text-sm opacity-0 group-hover:opacity-100"
            aria-label="Delete photo"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  )
}

