"use client"

import { useState } from "react"
import { useAuth } from "../../contexts/AuthContext"

export function UserMenu() {
  const { user, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  if (!user) return null

  const getInitials = (email: string) => {
    return email.substring(0, 2).toUpperCase()
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            backgroundColor: "#e0e7ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 500,
            color: "#2d66f5",
            overflow: "hidden",
          }}
        >
          {user.photoURL ? (
            <img
              src={user.photoURL || "/placeholder.svg"}
              alt={user.email || "User"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            getInitials(user.email || "U")
          )}
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#565e6c"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              backgroundColor: "#ffffff",
              border: "1px solid #dee1e6",
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
              minWidth: 200,
              zIndex: 1000,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #dee1e6",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  color: "#171a1f",
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                {user.displayName || "User"}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#6e7787",
                }}
              >
                {user.email}
              </div>
            </div>
            <button
              onClick={handleSignOut}
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "none",
                background: "transparent",
                textAlign: "left",
                cursor: "pointer",
                fontSize: 14,
                color: "#171a1f",
                transition: "background-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f8f9fa"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent"
              }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
