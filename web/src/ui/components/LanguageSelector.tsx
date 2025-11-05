import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface Language {
  code: string
  name: string
  nativeName: string
}

const languages: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
]

export function LanguageSelector() {
  const { i18n } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const [alignLeft, setAlignLeft] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0]

  const changeLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode)
    setIsOpen(false)
  }

  // Determine if dropdown should open upward and adjust horizontal position
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const dropdownHeight = 280 // Approximate height of dropdown with 5 languages
      const dropdownWidth = 180 // Width of dropdown
      
      // Open upward if not enough space below but enough space above
      setOpenUpward(spaceBelow < dropdownHeight && spaceAbove > spaceBelow)
      
      // On mobile or if there's not enough space on the right, align to left
      const isMobile = window.innerWidth <= 768
      const spaceRight = window.innerWidth - rect.right
      const spaceLeft = rect.left
      
      // Align left if mobile or if not enough space on right but enough on left
      setAlignLeft(isMobile || (spaceRight < dropdownWidth && spaceLeft > spaceRight))
    }
  }, [isOpen])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          backgroundColor: 'transparent',
          border: '1px solid #dee1e6',
          borderRadius: 6,
          fontSize: 14,
          color: '#171a1f',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#F3F4F6'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        <span>{currentLanguage.nativeName}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            transform: isOpen ? (openUpward ? 'rotate(0deg)' : 'rotate(180deg)') : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 998,
            }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              ...(openUpward
                ? {
                    bottom: '100%',
                    marginBottom: 8,
                  }
                : {
                    top: '100%',
                    marginTop: 8,
                  }),
              ...(alignLeft
                ? { left: 0, right: 'auto' }
                : { right: 0, left: 'auto' }),
              backgroundColor: 'white',
              border: '1px solid #dee1e6',
              borderRadius: 8,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              zIndex: 999,
              minWidth: 180,
              overflow: 'hidden',
            }}
          >
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  backgroundColor: i18n.language === lang.code ? '#EFF6FF' : 'transparent',
                  border: 'none',
                  fontSize: 14,
                  color: i18n.language === lang.code ? '#2d66f5' : '#171a1f',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (i18n.language !== lang.code) {
                    e.currentTarget.style.backgroundColor = '#F9FAFB'
                  }
                }}
                onMouseLeave={(e) => {
                  if (i18n.language !== lang.code) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
              >
                <div>
                  <div style={{ fontWeight: i18n.language === lang.code ? 600 : 400 }}>
                    {lang.nativeName}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#6e7787',
                      marginTop: 2,
                    }}
                  >
                    {lang.name}
                  </div>
                </div>
                {i18n.language === lang.code && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M13.3333 4L6 11.3333L2.66667 8"
                      stroke="#2d66f5"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
