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

    const { photo, error: uploadError } = await uploadPhoto(user.id, file)

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
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 h-full flex flex-col items-center justify-center min-h-[300px]">
        <div className="text-6xl mb-4">📸</div>
        <h3 className="text-xl font-semibold text-gray-100 mb-2">Photo Gallery</h3>
        <p className="text-gray-400 text-sm mb-4 text-center">Upload photos to create your gallery</p>
        <button
          onClick={() => setShowUpload(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 text-sm font-medium"
        >
          Upload Photo
        </button>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 h-full flex flex-col min-h-[300px]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-100">Photo Gallery</h3>
        <div className="flex items-center space-x-2">
          {photos.length > 0 && (
            <span className="text-sm text-gray-400">
              {currentIndex + 1} / {photos.length}
            </span>
          )}
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="bg-indigo-600 text-white px-3 py-1 rounded-md hover:bg-indigo-500 text-sm font-medium"
          >
            {showUpload ? 'Cancel' : 'Upload'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {showUpload && (
        <div className="mb-4 p-4 bg-gray-700 rounded border border-gray-600">
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
            className={`block text-center py-3 px-4 border-2 border-dashed rounded-md cursor-pointer transition-colors ${
              uploading
                ? 'border-gray-500 bg-gray-600'
                : 'border-indigo-500 bg-gray-700 hover:border-indigo-400 hover:bg-gray-600'
            }`}
          >
            {uploading ? (
              <span className="text-gray-300">Uploading...</span>
            ) : (
              <span className="text-indigo-400">Click to select an image</span>
            )}
          </label>
          <p className="text-xs text-gray-400 mt-2 text-center">Max 5MB, images only</p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="flex-1 relative overflow-hidden rounded-lg bg-gray-900">
          <img
            src={photos[currentIndex].url}
            alt={`Photo ${currentIndex + 1}`}
            className="w-full h-full object-contain"
            style={{ maxHeight: '400px' }}
          />

          {/* Navigation buttons */}
          {photos.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                aria-label="Previous photo"
              >
                ←
              </button>
              <button
                onClick={handleNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                aria-label="Next photo"
              >
                →
              </button>
            </>
          )}

          {/* Delete button */}
          <button
            onClick={() => handleDelete(photos[currentIndex])}
            className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-600 text-white p-2 rounded-full transition-colors"
            aria-label="Delete photo"
          >
            🗑️
          </button>

          {/* Dots indicator */}
          {photos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-2">
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
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentIndex ? 'bg-indigo-500' : 'bg-gray-500'
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

