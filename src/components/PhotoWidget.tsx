import { useState, useRef, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { useAuth } from '../lib/auth'
import { usePhotos } from '../contexts/PhotoContext'
import { uploadPhoto, deletePhoto, savePhotoAssignment } from '../lib/api'
import { compressImage } from '../lib/imageCompression'
import type { Photo } from '../types'
import type { Area } from 'react-easy-crop'

interface PhotoWidgetProps {
  photoIndex?: number // Which photo to show (0, 1, 2, etc.)
  tall?: boolean // If true, widget will be taller (4:3 aspect ratio)
  fillHeight?: boolean // If true, widget will fill available height instead of using aspect ratio
  wide?: boolean // If true, widget will be ultra-wide banner (3:1 aspect ratio)
  mediumWide?: boolean // If true, widget will be medium-wide (2:1 aspect ratio)
}

export default function PhotoWidget({ photoIndex = 0, tall = false, fillHeight = false, wide = false, mediumWide = false }: PhotoWidgetProps) {
  const { user } = useAuth()
  const { photos, photoAssignments, refreshPhotos, refreshAssignments } = usePhotos()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [showCropper, setShowCropper] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Photos and assignments are now loaded once via PhotoContext and shared between all widgets
  // This dramatically reduces storage egress by avoiding duplicate photo loads

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const createCroppedImage = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
    const image = new Image()
    image.src = imageSrc
    await new Promise((resolve) => {
      image.onload = resolve
    })

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No 2d context')

    canvas.width = pixelCrop.width
    canvas.height = pixelCrop.height

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    )

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Canvas is empty'))
        }
      }, 'image/jpeg', 0.85) // Lower quality (85%) - compression will optimize further
    })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setError(null)
    setSelectedFile(file)

    // Read the file and show the cropper
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result
      if (result && typeof result === 'string') {
        console.log('Image loaded, switching to cropper')
        setImageSrc(result)
        // Keep upload modal closed and show cropper
      setShowUpload(false)
        setShowCropper(true)
      }
    }
    reader.onerror = () => {
      setError('Failed to read image file')
      setSelectedFile(null)
    }
    reader.readAsDataURL(file)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCropConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels || !selectedFile || !user) return

    setUploading(true)
    setError(null)

    try {
      // Create cropped image blob
      const croppedBlob = await createCroppedImage(imageSrc, croppedAreaPixels)
      
      // Convert blob to File
      const croppedFile = new File([croppedBlob], selectedFile.name, {
        type: 'image/jpeg',
        lastModified: Date.now()
      })

      // Compress the image before uploading to reduce storage egress
      // Photo widgets are displayed in responsive grids (typically 150-400px wide)
      // 1000px is enough for 2.5x retina, 300KB drastically reduces egress
      console.log('Compressing image before upload...')
      const compressedFile = await compressImage(croppedFile, 0.3, 1000) // Max 300KB, max 1000px
      
      const { photo, error: uploadError } = await uploadPhoto(compressedFile)

      if (uploadError) {
        setError(uploadError)
      } else if (photo) {
        // Store which photo is assigned to this widget in the database
        console.log(`Saving photo assignment to database: widget ${photoIndex} = ${photo.id}`)
        await savePhotoAssignment(user.id, photoIndex, photo.id)
        // Refresh photos and assignments from shared context
        await refreshPhotos()
        await refreshAssignments()
        console.log('Closing cropper modal...')
        setShowCropper(false)
        setImageSrc(null)
        setSelectedFile(null)
        setCrop({ x: 0, y: 0 })
        setZoom(1)
        setCroppedAreaPixels(null)
        console.log('Cropper modal closed')
      }
    } catch (err) {
      setError('Failed to crop image')
      console.error('Crop error:', err)
    }

    setUploading(false)
  }

  const handleCropCancel = () => {
    setShowCropper(false)
    setImageSrc(null)
    setSelectedFile(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    setShowUpload(true)
  }

  const handleDelete = async (photo: Photo) => {
    if (!user || !confirm('Are you sure you want to delete this photo?')) return

    const { error: deleteError } = await deletePhoto(photo.id, photo.storage_path)

    if (deleteError) {
      setError(deleteError)
    } else {
      // Refresh photos and assignments from shared context
      await refreshPhotos()
      await refreshAssignments()
    }
  }

  // Get the photo to display - each widget shows a specific photo based on database assignment
  // If a photo is assigned to this widget, show it. Otherwise, don't show anything (to avoid duplicates)
  const getDisplayPhoto = () => {
    const assignedPhotoId = photoAssignments[photoIndex]
    
    if (assignedPhotoId) {
      // Find the photo with this ID
      const assignedPhoto = photos.find(p => p.id === assignedPhotoId)
      if (assignedPhoto) {
        return assignedPhoto
      }
    }
    
    // No assignment - don't show anything to avoid duplicates
    // User must explicitly upload to each widget
    return null
  }
  
  const displayPhoto = getDisplayPhoto()

  // For wide banners, use responsive aspect ratios
  const aspectClass = fillHeight 
    ? 'h-full' 
    : (wide 
      ? 'aspect-[3/1]' 
      : (mediumWide
        ? 'aspect-[2/1]'
      : (tall 
          ? 'aspect-[4/3]' 
          : 'aspect-square')))

  // Render empty state with cropper modal when this widget has no photo
  if (!displayPhoto && !showUpload && !showCropper) {
    return (
      <>
        {/* Crop Modal - Must be rendered even in empty state */}
        {showCropper && imageSrc && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <div className="glass backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-700/50 flex flex-col" style={{ height: '85vh' }}>
              <div className="p-4 border-b border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                      <span className="text-xl">✂️</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-100">Crop Your Image</h3>
                  </div>
                  <button
                    onClick={handleCropCancel}
                    disabled={uploading}
                    className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-700/50 disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {error && (
                <div className="mx-4 mt-4 bg-red-900/30 border border-red-700/50 text-red-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Cropper Area */}
              <div className="flex-1 relative bg-black/50 rounded-xl m-4">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={wide ? 3/1 : (mediumWide ? 2/1 : (tall ? 4/3 : (fillHeight ? 16/9 : 1)))}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  style={{
                    containerStyle: {
                      borderRadius: '0.75rem',
                    },
                  }}
                />
              </div>

              {/* Controls */}
              <div className="p-4 space-y-4 border-t border-slate-700/50">
                {/* Zoom Slider */}
                <div className="flex items-center gap-3">
                  <span className="text-slate-300 text-sm font-medium whitespace-nowrap">Zoom:</span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    disabled={uploading}
                    className="flex-1 h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCropCancel}
                    disabled={uploading}
                    className="flex-1 bg-slate-700/50 hover:bg-slate-600/50 text-white px-4 py-3 rounded-xl transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCropConfirm}
                    disabled={uploading}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-3 rounded-xl transition-all font-medium shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                  >
                    {uploading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-spin">⏳</span>
                        Uploading...
                      </span>
                    ) : (
                      'Crop & Upload'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={`glass backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 sm:p-6 ${aspectClass} flex flex-col items-center justify-between overflow-hidden shadow-xl group hover:border-indigo-500/50 transition-all relative`}>
          {/* Gradient background for empty state */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10"></div>
          
          <div className="relative z-10 w-full flex justify-end mb-2">
        <button
          onClick={() => setShowUpload(true)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-xl hover:from-indigo-500 hover:to-purple-500 text-sm font-medium transition-all shadow-lg hover:shadow-xl active:scale-95"
        >
              Upload Photo
        </button>
      </div>
          
          <div className="relative z-10 flex flex-col items-center flex-1 justify-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform border-2 border-indigo-500/30">
              <span className="text-4xl">📸</span>
            </div>
            <h3 className="text-base font-bold text-white">Add a Photo</h3>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Crop Modal - Fixed Overlay */}
      {showCropper && imageSrc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="glass backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-700/50 flex flex-col" style={{ height: '85vh' }}>
            <div className="p-4 border-b border-slate-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <span className="text-xl">✂️</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100">Crop Your Image</h3>
                </div>
                <button
                  onClick={handleCropCancel}
                  disabled={uploading}
                  className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-700/50 disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <div className="mx-4 mt-4 bg-red-900/30 border border-red-700/50 text-red-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Cropper Area */}
            <div className="flex-1 relative bg-black/50 rounded-xl m-4">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={wide ? 21/9 : (tall ? 4/3 : (fillHeight ? 16/9 : 1))}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                style={{
                  containerStyle: {
                    borderRadius: '0.75rem',
                  },
                }}
              />
            </div>

            {/* Controls */}
            <div className="p-4 space-y-4 border-t border-slate-700/50">
              {/* Zoom Slider */}
              <div className="flex items-center gap-3">
                <span className="text-slate-300 text-sm font-medium whitespace-nowrap">Zoom:</span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  disabled={uploading}
                  className="flex-1 h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
            <button
                  onClick={handleCropCancel}
                  disabled={uploading}
                  className="flex-1 bg-slate-700/50 hover:bg-slate-600/50 text-white px-4 py-3 rounded-xl transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
                <button
                  onClick={handleCropConfirm}
                  disabled={uploading}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-3 rounded-xl transition-all font-medium shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin">⏳</span>
                      Uploading...
                    </span>
                  ) : (
                    'Crop & Upload'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal - Fixed Overlay */}
      {showUpload && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="glass backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md border border-slate-700/50">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <span className="text-xl">📸</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100">Upload Photo</h3>
                </div>
                <button
                  onClick={() => setShowUpload(false)}
                  className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-700/50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

      {error && (
                <div className="bg-red-900/30 border border-red-700/50 text-red-200 px-4 py-3 rounded-xl text-sm flex items-center gap-2 mb-4">
                  <span>⚠️</span>
                  <span>{error}</span>
        </div>
      )}

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
                className={`block text-center py-12 px-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
              uploading
                    ? 'border-slate-500/50 bg-slate-700/30'
                    : 'border-indigo-500/40 bg-slate-800/30 hover:border-indigo-400/60 hover:bg-slate-700/40 active:bg-slate-700/50'
            }`}
          >
            {uploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center animate-pulse">
                      <span className="text-2xl">⏳</span>
                    </div>
                    <span className="text-slate-300 text-sm font-medium">Uploading...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-indigo-300 font-medium text-sm mb-1">Click to select an image</p>
                      <p className="text-xs text-slate-400">Max 5MB • JPG, PNG, GIF</p>
                    </div>
                  </div>
            )}
          </label>
            </div>
          </div>
        </div>
      )}

      {/* Photo Display */}
      <div className={`glass backdrop-blur-xl border border-slate-700/50 rounded-2xl overflow-hidden ${aspectClass} flex flex-col group relative w-full shadow-xl`}>

      {displayPhoto && (
        <div className="flex-1 relative overflow-hidden w-full h-full group rounded-2xl shadow-xl">
          <img
            src={displayPhoto.url}
            alt={`Photo ${photoIndex + 1}`}
            className="w-full h-full object-cover rounded-2xl transition-transform duration-300 group-hover:scale-105"
            style={{ imageRendering: 'auto' }}
            loading="lazy"
            decoding="async"
          />
          
          {/* Subtle vignette effect - only on edges */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none rounded-2xl opacity-50"></div>
          
          {/* Action buttons overlay - appears on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"></div>

          {/* Button container - top right for fillHeight, wide or mediumWide, bottom right otherwise */}
          <div className={`absolute ${fillHeight || wide || mediumWide ? 'top-3 right-3' : 'bottom-3 right-3'} flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
            {/* Change photo button */}
            <button
              onClick={() => setShowUpload(true)}
              className="bg-indigo-600/90 hover:bg-indigo-500 text-white p-2.5 rounded-xl transition-all shadow-lg backdrop-blur-md hover:shadow-xl active:scale-95 min-w-[40px] min-h-[40px] flex items-center justify-center"
              aria-label="Change photo"
              title="Change photo"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            
            {/* Delete button */}
          <button
            onClick={() => handleDelete(displayPhoto)}
              className="bg-red-600/90 hover:bg-red-500 text-white p-2.5 rounded-xl transition-all shadow-lg backdrop-blur-md hover:shadow-xl active:scale-95 min-w-[40px] min-h-[40px] flex items-center justify-center"
            aria-label="Delete photo"
              title="Delete photo"
          >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
          </button>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

