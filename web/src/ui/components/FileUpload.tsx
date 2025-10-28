import React, { useState, useRef } from 'react'
import { uploadPdfFile, UploadProgress } from '../../services/uploadService'

interface FileUploadProps {
  onUploadComplete?: () => void
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileSelect = async (file: File) => {
    setError(null)
    setSelectedFile(file)
    
    // Automatically upload the file
    await handleUpload(file)
  }

  const handleUpload = async (file: File) => {
    setIsUploading(true)
    setError(null)
    setProgress(null)

    try {
      await uploadPdfFile(file, (p) => {
        setProgress(p)
      })

      // Upload complete
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      
      setTimeout(() => {
        setProgress(null)
        setIsUploading(false)
        onUploadComplete?.()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setIsUploading(false)
      setProgress(null)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', marginBottom: 48 }}>
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${isDragging ? '#4F46E5' : '#E5E7EB'}`,
          borderRadius: 8,
          padding: '80px 48px',
          textAlign: 'center',
          backgroundColor: isDragging ? '#F9FAFB' : 'white',
          transition: 'all 0.2s ease',
          cursor: isUploading ? 'not-allowed' : 'pointer',
        }}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
          disabled={isUploading}
        />

        <img src="/icons/lucide-FileUp-Outlined.svg" alt="" style={{ width: 56, height: 56, marginBottom: 24, opacity: 0.6 }} />
        
        <h3 style={{ margin: '0 0 8px 0', fontSize: 16, fontWeight: 400, color: '#111827' }}>
          Перетащите PDF-файл сюда или нажмите, чтобы выбрать
        </h3>
        
        <p style={{ margin: 0, fontSize: 14, color: '#6B7280', fontWeight: 400 }}>
          Максимальный размер файла: 200 МБ
        </p>
      </div>

      {isUploading && progress && (
        <div style={{ marginTop: 24 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: 8,
            fontSize: 14,
            color: '#6B7280',
          }}>
            <span>{progress.message}</span>
            <span>{progress.progress}%</span>
          </div>
          <div style={{
            width: '100%',
            height: 8,
            backgroundColor: '#E5E7EB',
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <div
              style={{
                width: `${progress.progress}%`,
                height: '100%',
                backgroundColor: progress.stage === 'error' ? '#EF4444' : '#4F46E5',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 16,
          padding: 16,
          backgroundColor: '#FEE2E2',
          border: '1px solid #FCA5A5',
          borderRadius: 8,
          color: '#991B1B',
          fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {progress?.stage === 'complete' && (
        <div style={{
          marginTop: 16,
          padding: 16,
          backgroundColor: '#D1FAE5',
          border: '1px solid #6EE7B7',
          borderRadius: 8,
          color: '#065F46',
          fontSize: 14,
          fontWeight: 600,
        }}>
          ✓ Upload complete!
        </div>
      )}
    </div>
  )
}


