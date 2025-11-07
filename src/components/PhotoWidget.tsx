import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { getUserPhotos, uploadPhoto, deletePhoto } from '../lib/api'
import type { Photo } from '../types'

interface PhotoWidgetProps {
  photoIndex?: number // Which photo to show (0, 1, 2, etc.)
}

export default function PhotoWidget({ photoIndex = 0 }: PhotoWidgetProps) {
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
      await loadPhotos()
    }
  }

  // Get the photo to display (cycle through available photos based on photoIndex)
  const displayPhoto = photos.length > 0 ? photos[photoIndex % photos.length] : null

  if (photos.length === 0 && !showUpload) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-3 sm:p-4 aspect-square flex flex-col items-center justify-center overflow-hidden">
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
    <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-lg overflow-hidden aspect-square flex flex-col group">
      {/* Compact header overlay when showing photo */}
      {displayPhoto && !showUpload && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-end p-2 bg-gradient-to-b from-black/60 to-transparent backdrop-blur-sm">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="bg-indigo-600/90 hover:bg-indigo-500 text-white px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors shadow-md active:scale-95 touch-manipulation backdrop-blur-sm"
          >
            {showUpload ? 'Cancel' : 'Upload'}
          </button>
        </div>
      )}

      {/* Regular header when upload is shown */}
      {showUpload && (
        <div className="p-2 sm:p-3 border-b border-gray-700">
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
        <div className="bg-red-900/50 border-b border-red-700/50 text-red-200 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm">
          {error}
        </div>
      )}

      {showUpload && (
        <div className="p-3 sm:p-4 bg-gray-800 flex-1 flex flex-col justify-center">
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
                ? 'border-gray-500 bg-gray-600/50'
                : 'border-indigo-500/50 bg-gray-700/30 hover:border-indigo-400 hover:bg-gray-600/30 active:bg-gray-600/40'
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
        <div className="flex-1 relative overflow-hidden bg-gray-900 w-full h-full">
          <img
            src={displayPhoto.url}
            alt={`Photo ${photoIndex + 1}`}
            className="w-full h-full object-cover"
          />

          {/* Delete button - bottom right */}
          <button
            onClick={() => handleDelete(displayPhoto)}
            className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 bg-red-600/80 hover:bg-red-600 active:bg-red-700 text-white p-2 sm:p-2.5 rounded-full transition-all shadow-lg backdrop-blur-md touch-manipulation min-w-[36px] min-h-[36px] flex items-center justify-center text-xs sm:text-sm"
            aria-label="Delete photo"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  )
}

