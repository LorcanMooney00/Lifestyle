import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/auth'
import { getUserPhotos, uploadPhoto, deletePhoto } from '../lib/api'
import type { Photo } from '../types'

export default function PhotoGallery() {
  const { user } = useAuth()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (user) {
      loadPhotos()
    }
  }, [user])

  useEffect(() => {
    // Auto-rotate through photos every 3 seconds
    if (photos.length > 1) {
      intervalRef.current = window.setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % photos.length)
      }, 3000)
    } else {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
      }
    }
  }, [photos.length])

  const loadPhotos = async () => {
    if (!user) return
    const photosData = await getUserPhotos(user.id)
    setPhotos(photosData)
    if (photosData.length > 0) {
      setCurrentIndex(0)
    }
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

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length)
    // Reset auto-rotate timer
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
    }
    intervalRef.current = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length)
    }, 3000)
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length)
    // Reset auto-rotate timer
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
    }
    intervalRef.current = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length)
    }, 3000)
  }

  if (photos.length === 0 && !showUpload) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-lg p-6 sm:p-8 h-full flex flex-col items-center justify-center min-h-[250px] sm:min-h-[300px]">
        <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">📸</div>
        <h3 className="text-lg sm:text-xl font-semibold text-gray-100 mb-2">Photo Gallery</h3>
        <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6 text-center px-4">Upload photos to create your gallery</p>
        <button
          onClick={() => setShowUpload(true)}
          className="bg-indigo-600 text-white px-6 py-3 sm:py-2.5 rounded-lg hover:bg-indigo-500 text-sm font-medium transition-colors shadow-md hover:shadow-lg active:scale-95 touch-manipulation"
        >
          Upload Photo
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-lg overflow-hidden h-full flex flex-col min-h-[250px] sm:min-h-[300px] group">
      {/* Compact header overlay when showing photos */}
      {photos.length > 0 && !showUpload && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-3 bg-gradient-to-b from-black/60 to-transparent backdrop-blur-sm">
          <h3 className="text-sm sm:text-base font-semibold text-white drop-shadow-lg">Photo Gallery</h3>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {photos.length > 0 && (
              <span className="text-xs sm:text-sm text-white/90 font-medium drop-shadow-lg">
                {currentIndex + 1} / {photos.length}
              </span>
            )}
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="bg-indigo-600/90 hover:bg-indigo-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors shadow-md active:scale-95 touch-manipulation backdrop-blur-sm"
            >
              {showUpload ? 'Cancel' : 'Upload'}
            </button>
          </div>
        </div>
      )}

      {/* Regular header when upload is shown */}
      {showUpload && (
        <div className="p-3 sm:p-4 border-b border-gray-700">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg font-bold text-gray-100">Photo Gallery</h3>
            <button
              onClick={() => setShowUpload(false)}
              className="bg-indigo-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-indigo-500 text-xs sm:text-sm font-medium transition-colors shadow-md hover:shadow-lg active:scale-95 touch-manipulation"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/50 border-b border-red-700/50 text-red-200 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm">
          {error}
        </div>
      )}

      {showUpload && (
        <div className="p-4 sm:p-5 bg-gray-800">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            id="photo-upload"
          />
          <label
            htmlFor="photo-upload"
            className={`block text-center py-4 sm:py-4 px-3 sm:px-4 border-2 border-dashed rounded-lg cursor-pointer transition-all touch-manipulation min-h-[60px] flex items-center justify-center ${
              uploading
                ? 'border-gray-500 bg-gray-600/50'
                : 'border-indigo-500/50 bg-gray-700/30 hover:border-indigo-400 hover:bg-gray-600/30 active:bg-gray-600/40'
            }`}
          >
            {uploading ? (
              <span className="text-gray-300 text-sm sm:text-base">Uploading...</span>
            ) : (
              <span className="text-indigo-400 font-medium text-sm sm:text-base">Click to select an image</span>
            )}
          </label>
          <p className="text-xs text-gray-400 mt-2 sm:mt-3 text-center">Max 5MB, images only</p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="flex-1 relative overflow-hidden bg-gray-900 min-h-[200px] sm:min-h-[300px]">
          <img
            src={photos[currentIndex].url}
            alt={`Photo ${currentIndex + 1}`}
            className="w-full h-full object-cover"
          />

          {/* Navigation buttons - only show on hover/active */}
          {photos.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 active:bg-black/70 text-white p-3 sm:p-2.5 rounded-full transition-all shadow-lg backdrop-blur-md touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center text-lg sm:text-base opacity-0 group-hover:opacity-100 hover:opacity-100"
                aria-label="Previous photo"
              >
                ←
              </button>
              <button
                onClick={handleNext}
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 active:bg-black/70 text-white p-3 sm:p-2.5 rounded-full transition-all shadow-lg backdrop-blur-md touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center text-lg sm:text-base opacity-0 group-hover:opacity-100 hover:opacity-100"
                aria-label="Next photo"
              >
                →
              </button>
            </>
          )}

          {/* Delete button - bottom right */}
          <button
            onClick={() => handleDelete(photos[currentIndex])}
            className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 bg-red-600/80 hover:bg-red-600 active:bg-red-700 text-white p-2.5 sm:p-2 rounded-full transition-all shadow-lg backdrop-blur-md touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center text-sm"
            aria-label="Delete photo"
          >
            🗑️
          </button>

          {/* Dots indicator - bottom center */}
          {photos.length > 1 && (
            <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2 bg-black/40 backdrop-blur-md px-2 sm:px-3 py-1.5 sm:py-2 rounded-full">
              {photos.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentIndex(index)
                    // Reset auto-rotate timer
                    if (intervalRef.current) {
                      window.clearInterval(intervalRef.current)
                    }
                    intervalRef.current = window.setInterval(() => {
                      setCurrentIndex((prev) => (prev + 1) % photos.length)
                    }, 3000)
                  }}
                  className={`rounded-full transition-all touch-manipulation ${
                    index === currentIndex 
                      ? 'bg-white w-6 sm:w-6 h-2 sm:h-2' 
                      : 'bg-white/50 hover:bg-white/70 active:bg-white/70 w-2 sm:w-2 h-2 sm:h-2'
                  }`}
                  aria-label={`Go to photo ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

