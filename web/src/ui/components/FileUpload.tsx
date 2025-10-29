"use client"

import type React from "react"
import { useState, useRef } from "react"
import { uploadPdfFile, type UploadProgress } from "../../services/uploadService"

interface FileUploadProps {
  onUploadComplete?: () => void
}

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showInfo, setShowInfo] = useState(true)
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
        fileInputRef.current.value = ""
      }

      setTimeout(() => {
        setProgress(null)
        setIsUploading(false)
        onUploadComplete?.()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
      setIsUploading(false)
      setProgress(null)
    }
  }

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        marginBottom: 48,
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 12,
          padding: "48px 32px",
          marginBottom: 24,
        }}
      >
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? "#2d66f5" : "#bcc1ca"}`,
            borderRadius: 12,
            padding: "80px 48px",
            textAlign: "center",
            backgroundColor: isDragging ? "#f1f8fd" : "transparent",
            transition: "all 0.2s ease",
            cursor: isUploading ? "not-allowed" : "pointer",
          }}
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileInputChange}
            style={{ display: "none" }}
            disabled={isUploading}
          />

          <div style={{ marginBottom: 24 }}>
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2d66f5"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ margin: "0 auto", display: "block" }}
            >
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
              <polyline points="16 16 12 12 8 16"></polyline>
              <line x1="12" y1="12" x2="12" y2="21"></line>
            </svg>
          </div>

          <h3
            style={{
              margin: "0 0 8px 0",
              fontSize: 18,
              fontWeight: 400,
              color: "#171a1f",
              lineHeight: 1.5,
            }}
          >
            Drag and drop here to upload.
          </h3>

          <p
            style={{
              margin: "0 0 16px 0",
              fontSize: 16,
              color: "#565e6c",
              fontWeight: 400,
              lineHeight: 1.5,
            }}
          >
            Choose files or folders from your computer.
          </p>

          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "#9095a0",
              fontWeight: 400,
              fontStyle: "italic",
            }}
          >
            Support .pdf, up to 25 MB
          </p>
        </div>

        {isUploading && progress && (
          <div style={{ marginTop: 32 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 12,
                fontSize: 14,
                color: "#565e6c",
              }}
            >
              <span>{progress.message}</span>
              <span>{progress.progress}%</span>
            </div>
            <div
              style={{
                width: "100%",
                height: 8,
                backgroundColor: "#dee1e6",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress.progress}%`,
                  height: "100%",
                  backgroundColor: progress.stage === "error" ? "#EF4444" : "#2d66f5",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 24,
              padding: 16,
              backgroundColor: "#FEE2E2",
              border: "1px solid #FCA5A5",
              borderRadius: 8,
              color: "#991B1B",
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}

        {progress?.stage === "complete" && (
          <div
            style={{
              marginTop: 24,
              padding: 16,
              backgroundColor: "#D1FAE5",
              border: "1px solid #6EE7B7",
              borderRadius: 8,
              color: "#065F46",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ✓ Upload complete!
          </div>
        )}
      </div>

      {showInfo && (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 12,
            padding: "24px 32px",
            position: "relative",
          }}
        >
          <button
            onClick={() => setShowInfo(false)}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 24,
              height: 24,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9095a0"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <h4
            style={{
              margin: "0 0 20px 0",
              fontSize: 14,
              fontWeight: 400,
              color: "#9095a0",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            MORE OF WHAT YOU CAN DO:
          </h4>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2d66f5"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                </svg>
              </div>
              <div>
                <span style={{ fontSize: 15, color: "#171a1f", fontWeight: 500 }}>Take Your Files Anywhere</span>
                <span style={{ fontSize: 15, color: "#6e7787", fontWeight: 400 }}>
                  {" "}
                  for easy access on all your devices
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div
                style={{
                  width: 20,
                  height: 20,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2d66f5"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
              </div>
              <div>
                <span style={{ fontSize: 15, color: "#171a1f", fontWeight: 500 }}>Supported Files</span>
                <span style={{ fontSize: 15, color: "#6e7787", fontWeight: 400 }}>
                  {" "}
                  upload PDF files with a maximum size of 25 MB
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
