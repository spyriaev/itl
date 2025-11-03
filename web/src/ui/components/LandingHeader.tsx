import React from 'react'
import { useTranslation } from 'react-i18next'
import '../styles/buttons.css'
import '../styles/typography.css'

interface LandingHeaderProps {
  onTryClick: () => void
}

export function LandingHeader({ onTryClick }: LandingHeaderProps) {
  const { t } = useTranslation()

  return (
    <>
      <div style={styles.betaBanner} data-beta-banner>
        {t("landing.betaAccess")}
      </div>
      <header style={styles.header} data-landing-header>
        <div style={styles.logoContainer} data-landing-logo>
          <div style={styles.logoIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5.75 21.25H15.45C17.1302 21.25 17.9702 21.25 18.612 20.923C19.1765 20.6354 19.6354 20.1765 19.923 19.612C20.25 18.9702 20.25 18.1302 20.25 16.45V10.9882C20.25 10.2545 20.25 9.88757 20.1671 9.5423C20.0936 9.2362 19.9724 8.94356 19.8079 8.67515C19.6224 8.3724 19.363 8.11297 18.8441 7.59411L15.4059 4.15589C14.887 3.63703 14.6276 3.37761 14.3249 3.19208C14.0564 3.02759 13.7638 2.90638 13.4577 2.83289C13.1124 2.75 12.7455 2.75 12.0118 2.75H9.875H9.25C8.78558 2.75 8.55337 2.75 8.35842 2.77567C7.01222 2.9529 5.9529 4.01222 5.77567 5.35842C5.75 5.55337 5.75 5.78558 5.75 6.25" stroke="#2d66f5" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M13.75 2.75V4.45C13.75 6.13016 13.75 6.97024 14.077 7.61197C14.3646 8.17646 14.8235 8.6354 15.388 8.92302C16.0298 9.25 16.8698 9.25 18.55 9.25H20.25" stroke="#2d66f5" strokeWidth="1.5" />
              <path d="M9.33687 15.1876L8.67209 17.2136C8.53833 17.6213 7.96167 17.6213 7.82791 17.2136L7.16313 15.1876C7.03098 14.7849 6.71511 14.469 6.31236 14.3369L4.28637 13.6721C3.87872 13.5383 3.87872 12.9617 4.28637 12.8279L6.31236 12.1631C6.71511 12.031 7.03098 11.7151 7.16313 11.3124L7.82791 9.28637C7.96167 8.87872 8.53833 8.87872 8.67209 9.28637L9.33687 11.3124C9.46902 11.7151 9.78489 12.031 10.1876 12.1631L12.2136 12.8279C12.6213 12.9617 12.6213 13.5383 12.2136 13.6721L10.1876 14.3369C9.78489 14.469 9.46902 14.7849 9.33687 15.1876Z" fill="#2d66f5" />
            </svg>
          </div>
          <h1 style={styles.logoText} data-landing-logo-text>Innesi Reader</h1>
        </div>
        <nav style={styles.nav} data-landing-nav>
          <a href="#" style={styles.navLink} data-landing-nav-link>{t("landing.contact")}</a>
          <div style={styles.navItem}>
            <a href="#" style={styles.navLink} data-landing-nav-link>{t("landing.plans")}</a>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={styles.dropdownIcon}>
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <button className="button-primary" onClick={onTryClick} data-landing-try-button>
            {t("landing.tryInnesi")}
          </button>
        </nav>
      </header>
    </>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  betaBanner: {
    backgroundColor: '#1f2937',
    color: '#FFFFFF',
    textAlign: 'center',
    padding: '8px 16px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '16px',
    lineHeight: '26px',
    fontWeight: '500',
  },
  header: {
    backgroundColor: 'white',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 32px',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoIcon: {
    display: 'flex',
    alignItems: 'center',
  },
  logoText: {
    fontFamily: "'Red Hat Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '24px',
    lineHeight: '20px',
    fontWeight: '700',
    color: '#2D66F5',
    margin: 0,
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  navLink: {
    color: '#565E6C',
    textDecoration: 'none',
    fontSize: '14px',
    lineHeight: '22px',
    fontWeight: '400',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    transition: 'color 0.2s',
  },
  dropdownIcon: {
    color: '#374151',
  },
}

// Add hover styles for navigation links
if (!document.getElementById('landing-header-link-hover')) {
  const linkHoverStyle = document.createElement('style')
  linkHoverStyle.id = 'landing-header-link-hover'
  linkHoverStyle.textContent = `
    [data-landing-nav-link]:hover {
      color: #9ca3af !important;
    }
  `
  document.head.appendChild(linkHoverStyle)
}


