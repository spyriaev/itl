import React from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSelector } from './LanguageSelector'
import '../styles/landing.css'

export function LandingFooter() {
  const { t } = useTranslation()

  return (
    <footer style={styles.footer} data-landing-footer>
      {/* Top section - Logo and Navigation links */}
      <div style={styles.topSection} data-footer-top>
        {/* Logo */}
        <div style={styles.logoContainer}>
          <div style={styles.logoIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5.75 21.25H15.45C17.1302 21.25 17.9702 21.25 18.612 20.923C19.1765 20.6354 19.6354 20.1765 19.923 19.612C20.25 18.9702 20.25 18.1302 20.25 16.45V10.9882C20.25 10.2545 20.25 9.88757 20.1671 9.5423C20.0936 9.2362 19.9724 8.94356 19.8079 8.67515C19.6224 8.3724 19.363 8.11297 18.8441 7.59411L15.4059 4.15589C14.887 3.63703 14.6276 3.37761 14.3249 3.19208C14.0564 3.02759 13.7638 2.90638 13.4577 2.83289C13.1124 2.75 12.7455 2.75 12.0118 2.75H9.875H9.25C8.78558 2.75 8.55337 2.75 8.35842 2.77567C7.01222 2.9529 5.9529 4.01222 5.77567 5.35842C5.75 5.55337 5.75 5.78558 5.75 6.25" stroke="#2d66f5" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M13.75 2.75V4.45C13.75 6.13016 13.75 6.97024 14.077 7.61197C14.3646 8.17646 14.8235 8.6354 15.388 8.92302C16.0298 9.25 16.8698 9.25 18.55 9.25H20.25" stroke="#2d66f5" strokeWidth="1.5" />
              <path d="M9.33687 15.1876L8.67209 17.2136C8.53833 17.6213 7.96167 17.6213 7.82791 17.2136L7.16313 15.1876C7.03098 14.7849 6.71511 14.469 6.31236 14.3369L4.28637 13.6721C3.87872 13.5383 3.87872 12.9617 4.28637 12.8279L6.31236 12.1631C6.71511 12.031 7.03098 11.7151 7.16313 11.3124L7.82791 9.28637C7.96167 8.87872 8.53833 8.87872 8.67209 9.28637L9.33687 11.3124C9.46902 11.7151 9.78489 12.031 10.1876 12.1631L12.2136 12.8279C12.6213 12.9617 12.6213 13.5383 12.2136 13.6721L10.1876 14.3369C9.78489 14.469 9.46902 14.7849 9.33687 15.1876Z" fill="#2d66f5" />
            </svg>
          </div>
          <h2 style={styles.logoText}>Innesi Reader</h2>
        </div>
        
        {/* Navigation links */}
        <div style={styles.navLinks} data-footer-nav>
          <a href="#" style={styles.navLink}>{t("landing.footer.aboutUs")}</a>
          <a href="#" style={styles.navLink}>{t("landing.footer.ourProducts")}</a>
          <a href="#" style={styles.navLink}>{t("landing.footer.privacy")}</a>
          <a href="#" style={styles.navLink}>{t("landing.footer.terms")}</a>
        </div>
      </div>

      {/* Divider */}
      <div style={styles.divider}></div>

      {/* Bottom section - Social, Support and Language */}
      <div style={styles.bottomSection} data-footer-bottom>
        {/* Social media icons */}
        <div style={styles.socialContainer}>
          <a href="#" style={styles.socialButton} data-social-button aria-label="YouTube">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.54 6.42C22.4213 5.94541 22.1793 5.51057 21.8387 5.15941C21.498 4.80824 21.0707 4.55318 20.6 4.42C18.88 4 12 4 12 4C12 4 5.12 4 3.4 4.42C2.92931 4.55318 2.50196 4.80824 2.1613 5.15941C1.82065 5.51057 1.57866 5.94541 1.46 6.42C1.14521 8.16156 0.991235 9.92762 1 11.7C0.991235 13.4724 1.14521 15.2384 1.46 16.98C1.59125 17.4538 1.83847 17.8869 2.17714 18.2345C2.51581 18.5821 2.93482 18.833 3.4 18.96C5.12 19.38 12 19.38 12 19.38C12 19.38 18.88 19.38 20.6 18.96C21.0707 18.8268 21.498 18.5718 21.8387 18.2206C22.1793 17.8694 22.4213 17.4346 22.54 16.96C22.8548 15.2184 23.0088 13.4524 23 11.68C23.0088 9.90762 22.8548 8.14156 22.54 6.4V6.42ZM9.75 15.02L9.75 8.38L15.67 11.7L9.75 15.02Z" fill="#565E6C"/>
            </svg>
          </a>
          <a href="#" style={styles.socialButton} data-social-button aria-label="Facebook">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 12.073C24 5.40588 18.6274 0 12 0S0 5.40588 0 12.073C0 18.0988 4.38823 23.0938 10.125 23.8781V15.5633H7.07813V12.073H10.125V9.41338C10.125 6.3875 11.9166 4.71625 14.6576 4.71625C15.9701 4.71625 17.3438 4.95188 17.3438 4.95188V7.92313H15.8306C14.34 7.92313 13.875 8.85375 13.875 9.80875V12.073H17.2031L16.6711 15.5633H13.875V23.8781C19.6118 23.0938 24 18.0988 24 12.073Z" fill="#565E6C"/>
            </svg>
          </a>
          <a href="#" style={styles.socialButton} data-social-button aria-label="LinkedIn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20.447 20.452H16.893V14.883C16.893 13.555 16.866 11.846 15.041 11.846C13.188 11.846 12.905 13.291 12.905 14.785V20.452H9.351V9H12.765V10.561H12.811C13.288 9.661 14.448 8.711 16.181 8.711C19.782 8.711 20.448 11.081 20.448 14.166V20.452H20.447ZM5.337 7.433C4.193 7.433 3.274 6.507 3.274 5.367C3.274 4.224 4.194 3.305 5.337 3.305C6.477 3.305 7.401 4.224 7.401 5.367C7.401 6.507 6.476 7.433 5.337 7.433ZM7.119 20.452H3.555V9H7.119V20.452ZM22.225 0H1.771C0.792 0 0 0.774 0 1.729V22.271C0 23.227 0.792 24 1.771 24H22.222C23.2 24 24 23.227 24 22.271V1.729C24 0.774 23.2 0 22.222 0H22.225Z" fill="#565E6C"/>
            </svg>
          </a>
        </div>

        {/* Contact and Language */}
        <div style={styles.rightSide} data-footer-right>
          <div style={styles.contactText}>
            {t("landing.footer.havingQuestion")}{' '}
            <a href="#" style={styles.supportLink}>{t("landing.footer.support")}</a>
          </div>
          <div style={styles.languageSelectorWrapper}>
            <LanguageSelector />
          </div>
        </div>
      </div>
    </footer>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  footer: {
    backgroundColor: 'white',
    padding: '40px 32px',
    marginTop: '80px',
  },
  topSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '32px',
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
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: '48px',
  },
  navLink: {
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '14px',
    lineHeight: '22px',
    fontWeight: '400',
    color: '#565E6C',
    textDecoration: 'none',
    transition: 'color 0.2s',
  },
  divider: {
    height: '1px',
    backgroundColor: '#E5E7EB',
    marginBottom: '32px',
  },
  bottomSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  socialContainer: {
    display: 'flex',
    gap: '8px',
  },
  socialButton: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #E5E7EB',
    borderRadius: '4px',
    backgroundColor: 'white',
    transition: 'all 0.2s',
    textDecoration: 'none',
  },
  rightSide: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    flexWrap: 'wrap',
  },
  contactText: {
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '14px',
    lineHeight: '22px',
    fontWeight: '400',
    color: '#565E6C',
  },
  supportLink: {
    color: '#2D66F5',
    textDecoration: 'none',
    transition: 'color 0.2s',
  },
  languageSelectorWrapper: {
    display: 'flex',
    alignItems: 'center',
  },
}

// Add hover styles
if (!document.getElementById('landing-footer-hover')) {
  const footerHoverStyle = document.createElement('style')
  footerHoverStyle.id = 'landing-footer-hover'
  footerHoverStyle.textContent = `
    [data-footer-nav] a:hover {
      color: #9ca3af !important;
    }
    [data-landing-footer] a[style*="supportLink"]:hover,
    [data-landing-footer] .supportLink:hover {
      color: #1353F4 !important;
    }
    [data-landing-footer] [data-social-button]:hover {
      border-color: #9ca3af !important;
      background-color: #F9FAFB !important;
    }
  `
  document.head.appendChild(footerHoverStyle)
}

