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
    <div className="user-menu">
      <button className="user-menu-trigger" onClick={() => setIsOpen(!isOpen)}>
        {user.photoURL ? (
          <img src={user.photoURL || "/placeholder.svg"} alt={user.email || "User"} className="user-avatar" />
        ) : (
          <div
            className="user-avatar"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 500,
              color: "#2d66f5",
              backgroundColor: "#e0e7ff",
            }}
          >
            {getInitials(user.email || "U")}
          </div>
        )}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
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
          <div className="user-menu-dropdown">
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
            <button className="user-menu-item" onClick={handleSignOut}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
