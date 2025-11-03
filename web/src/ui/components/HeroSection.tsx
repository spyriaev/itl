import React from 'react'
import { useTranslation } from 'react-i18next'
import '../styles/buttons.css'
import '../styles/typography.css'

interface HeroSectionProps {
  onStartClick: () => void
}

export function HeroSection({ onStartClick }: HeroSectionProps) {
  const { t } = useTranslation()

  return (
    <section style={styles.hero} data-hero-section>
      <div style={styles.heroContent} data-hero-content>
        <div style={styles.heroLeft} data-hero-left>
          <h1 className="text-heading-large" data-hero-title>{t("landing.heroTitle")}</h1>
          <p className="text-body" data-hero-subtitle>{t("landing.heroSubtitle")}</p>
          <div style={styles.heroButtons} data-hero-buttons>
            <button className="button-secondary" data-hero-button>
              <svg className="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              {t("landing.downloadApps")}
            </button>
            <button className="button-primary" onClick={onStartClick} data-hero-button>
              {t("landing.startOnWeb")}
            </button>
          </div>
          <div style={styles.badge}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            {t("landing.soon")}
          </div>
        </div>
        <div style={styles.heroRight} data-hero-right>
          <div style={styles.laptopContainer}>
            <div style={styles.laptop}>
              <div style={styles.laptopScreen}>
                <div style={styles.screenContent}>
                  <div style={styles.sidebar}>
                    <div style={styles.sidebarItem}></div>
                    <div style={styles.sidebarItem}></div>
                    <div style={styles.sidebarItem}></div>
                    <div style={styles.sidebarItem}></div>
                    <div style={styles.sidebarItem}></div>
                    <div style={styles.sidebarItem}></div>
                  </div>
                  <div style={styles.mainContent}>
                    <div style={styles.folderList}>
                      <div style={styles.folderItem}></div>
                      <div style={styles.folderItem}></div>
                      <div style={styles.folderItem}></div>
                    </div>
                    <div style={styles.recommended}>Recommended</div>
                    <div style={styles.storage}>290 GB</div>
                  </div>
                </div>
              </div>
              <div style={styles.laptopBase}></div>
            </div>
            <div style={styles.uploadPopup}>
              <div style={styles.uploadTitle}>Загружайте pdf файлы</div>
              <div style={styles.uploadProgress}>546 GB of 1000 GB used</div>
              <div style={styles.progressBar}>
                <div style={styles.progressFill}></div>
              </div>
              <div style={styles.progressPercent}>52%</div>
            </div>
            <div style={styles.shareButton}>@share files...</div>
            <div style={styles.commentBubble}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Add a comment
            </div>
            <div style={styles.coffeeCup}>
              <div style={styles.cupHandle}></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  hero: {
    padding: '80px 32px',
    maxWidth: '1280px',
    margin: '0 auto',
  },
  heroContent: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '64px',
    alignItems: 'center',
  },
  heroLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  heroButtons: {
    display: 'flex',
    gap: '16px',
    marginTop: '8px',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#10b981',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600',
    width: 'fit-content',
  },
  heroRight: {
    position: 'relative',
  },
  laptopContainer: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  laptop: {
    position: 'relative',
    width: '500px',
    zIndex: 1,
  },
  laptopScreen: {
    backgroundColor: '#f3f4f6',
    borderRadius: '12px 12px 0 0',
    padding: '16px',
    border: '2px solid #e5e7eb',
    borderBottom: 'none',
  },
  screenContent: {
    backgroundColor: 'white',
    borderRadius: '8px',
    height: '300px',
    display: 'flex',
    overflow: 'hidden',
  },
  sidebar: {
    width: '60px',
    backgroundColor: '#2d66f5',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '12px',
  },
  sidebarItem: {
    width: '36px',
    height: '36px',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
  },
  mainContent: {
    flex: 1,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  folderList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  folderItem: {
    height: '40px',
    backgroundColor: '#f3f4f6',
    borderRadius: '6px',
  },
  recommended: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginTop: '8px',
  },
  storage: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: 'auto',
  },
  laptopBase: {
    height: '12px',
    backgroundColor: '#d1d5db',
    borderRadius: '0 0 8px 8px',
    border: '2px solid #e5e7eb',
    borderTop: 'none',
  },
  uploadPopup: {
    position: 'absolute',
    top: '20px',
    right: '-80px',
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
    minWidth: '200px',
    zIndex: 2,
  },
  uploadTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px',
  },
  uploadProgress: {
    fontSize: '12px',
    color: '#6b7280',
    marginBottom: '8px',
  },
  progressBar: {
    height: '6px',
    backgroundColor: '#e5e7eb',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '4px',
  },
  progressFill: {
    height: '100%',
    width: '52%',
    backgroundColor: '#2d66f5',
    borderRadius: '3px',
  },
  progressPercent: {
    fontSize: '12px',
    color: '#6b7280',
  },
  shareButton: {
    position: 'absolute',
    bottom: '40px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#1f2937',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '500',
    zIndex: 2,
  },
  commentBubble: {
    position: 'absolute',
    bottom: '20px',
    right: '20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '8px 12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#374151',
    zIndex: 2,
  },
  coffeeCup: {
    position: 'absolute',
    right: '-40px',
    top: '60%',
    width: '60px',
    height: '60px',
    backgroundColor: 'white',
    borderRadius: '0 0 30px 30px',
    border: '2px solid #e5e7eb',
    zIndex: 2,
  },
  cupHandle: {
    position: 'absolute',
    right: '-12px',
    top: '10px',
    width: '24px',
    height: '32px',
    border: '2px solid #e5e7eb',
    borderRadius: '0 12px 12px 0',
    backgroundColor: 'transparent',
  },
}

// Add hover effects
if (!document.getElementById('hero-section-hover-style')) {
  const hoverStyle = document.createElement('style')
  hoverStyle.id = 'hero-section-hover-style'
  hoverStyle.textContent = `
    button:hover:not(:disabled) {
      opacity: 0.9;
      transform: translateY(-1px);
    }
    button:active:not(:disabled) {
      transform: translateY(0);
    }
  `
  document.head.appendChild(hoverStyle)
}

