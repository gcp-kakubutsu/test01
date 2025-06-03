'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { X, ZoomIn, ZoomOut, Move } from 'lucide-react'

interface ImagePositionAdjusterProps {
  imageUrl: string
  onSave: (croppedImage: Blob) => void
  onCancel: () => void
  aspectRatio?: number
  circular?: boolean
}

export function ImagePositionAdjuster({
  imageUrl,
  onSave,
  onCancel,
  aspectRatio = 1,
  circular = true,
}: ImagePositionAdjusterProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const image = new Image()
    image.src = imageUrl
    image.onload = () => {
      setImageSize({ width: image.width, height: image.height })
    }
  }, [imageUrl])

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    
    const containerRect = containerRef.current.getBoundingClientRect()
    const maxX = containerRect.width * 0.5
    const maxY = containerRect.height * 0.5
    
    const newX = Math.max(-maxX, Math.min(maxX, e.clientX - dragStart.x))
    const newY = Math.max(-maxY, Math.min(maxY, e.clientY - dragStart.y))
    
    setPosition({ x: newX, y: newY })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    const touch = e.touches[0]
    setIsDragging(true)
    setDragStart({
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return
    e.preventDefault()
    
    const touch = e.touches[0]
    const containerRect = containerRef.current.getBoundingClientRect()
    const maxX = containerRect.width * 0.5
    const maxY = containerRect.height * 0.5
    
    const newX = Math.max(-maxX, Math.min(maxX, touch.clientX - dragStart.x))
    const newY = Math.max(-maxY, Math.min(maxY, touch.clientY - dragStart.y))
    
    setPosition({ x: newX, y: newY })
  }

  const handleSave = async () => {
    if (!imageRef.current || !containerRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to a high resolution for better quality
    const outputSize = 800 // 800x800px output for better quality
    canvas.width = outputSize
    canvas.height = outputSize
    
    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // Clear canvas with white background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, outputSize, outputSize)

    // Save context state
    ctx.save()

    // Create circular clip if needed
    if (circular) {
      ctx.beginPath()
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2)
      ctx.clip()
    }

    // Calculate the visible area size in the preview
    const containerRect = containerRef.current.getBoundingClientRect()
    const previewSize = Math.min(containerRect.width, containerRect.height)

    // Calculate how the image should be drawn
    const img = imageRef.current
    const scaleFactor = scale

    // Calculate the scaled dimensions
    const scaledWidth = previewSize * scaleFactor
    const scaledHeight = previewSize * scaleFactor
    
    // Calculate scale ratio between canvas and preview
    const canvasToPreviewRatio = outputSize / previewSize
    
    // Calculate the source rectangle based on position and scale
    const cropSize = imageSize.width / scaleFactor
    const centerX = imageSize.width / 2
    const centerY = imageSize.height / 2
    
    const offsetX = (position.x / previewSize) * imageSize.width / scaleFactor
    const offsetY = (position.y / previewSize) * imageSize.height / scaleFactor
    
    const sourceX = Math.max(0, centerX - cropSize / 2 - offsetX)
    const sourceY = Math.max(0, centerY - cropSize / 2 - offsetY)
    const sourceWidth = Math.min(cropSize, imageSize.width - sourceX)
    const sourceHeight = Math.min(cropSize, imageSize.height - sourceY)

    // Draw the image with proper scaling
    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      outputSize,
      outputSize
    )

    // Restore context
    ctx.restore()

    // Convert to blob with high quality
    canvas.toBlob((blob) => {
      if (blob) {
        onSave(blob)
      }
    }, 'image/jpeg', 0.98)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">画像の位置を調整</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div
          ref={containerRef}
          className="relative mx-auto mb-6 overflow-hidden cursor-move select-none"
          style={{
            width: '320px',
            height: '320px',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
        >
          <div
            className={`absolute inset-0 ${
              circular ? 'rounded-full' : 'rounded-lg'
            } border-2 border-pink-500 overflow-hidden bg-gray-100`}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Adjust position"
              className="absolute top-1/2 left-1/2"
              style={{
                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale})`,
                maxWidth: 'none',
                width: '320px',
                height: '320px',
                objectFit: 'cover',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
              draggable={false}
            />
          </div>
          {!isDragging && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Move className="h-8 w-8 text-white/50 drop-shadow-lg" />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <ZoomIn className="h-4 w-4" />
                ズーム
              </label>
              <span className="text-sm text-gray-500">{Math.round(scale * 100)}%</span>
            </div>
            <Slider
              value={[scale]}
              onValueChange={([value]) => setScale(value)}
              min={1}
              max={3}
              step={0.1}
              className="w-full"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
            >
              保存
            </Button>
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}