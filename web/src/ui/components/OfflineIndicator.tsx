/**
 * Offline Indicator Component
 * Shows a small icon in header and a banner below header when the app is offline
 */

import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import { useTranslation } from 'react-i18next'
import '../styles/offline-indicator.css'

const OfflineIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="-4 -4 40 40"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="square"
      strokeMiterlimit="10"
      d="M16.997,21.17 C18.164,21.581,19,22.693,19,24c0,1.657-1.343,3-3,3c-1.307,0-2.419-0.836-2.83-2.003"
      strokeLinejoin="miter"
    />
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="square"
      strokeMiterlimit="10"
      d="M23.778,16.222 C21.788,14.231,19.038,13,16,13c-3.038,0-5.788,1.231-7.778,3.222"
      strokeLinejoin="miter"
    />
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="square"
      strokeMiterlimit="10"
      d="M29.612,10.638 C26.128,7.155,21.316,5,16,5C10.684,5,5.872,7.155,2.388,10.638"
      strokeLinejoin="miter"
    />
    <line
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="square"
      strokeMiterlimit="10"
      x1="5"
      y1="27"
      x2="29"
      y2="3"
      strokeLinejoin="miter"
    />
  </svg>
)

export function OfflineIndicatorIcon() {
  const { isOffline } = useNetworkStatus()
  const { t } = useTranslation()

  if (!isOffline) {
    return null
  }

  return (
    <div className="offline-indicator-icon" role="alert" aria-live="polite" title={t('offline.noConnection', 'Нет подключения к интернету')}>
      <OfflineIcon />
    </div>
  )
}

interface OfflineIndicatorProps {
  hideInReader?: boolean
}

export function OfflineIndicator({ hideInReader = false }: OfflineIndicatorProps) {
  const { isOffline } = useNetworkStatus()
  const { t } = useTranslation()

  if (!isOffline || hideInReader) {
    return null
  }

  return (
    <div className="offline-indicator-banner" role="alert" aria-live="polite">
      <div className="offline-indicator-banner-content">
        <svg
          width="18"
          height="18"
          viewBox="-4 -4 40 40"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="square"
            strokeMiterlimit="10"
            d="M16.997,21.17 C18.164,21.581,19,22.693,19,24c0,1.657-1.343,3-3,3c-1.307,0-2.419-0.836-2.83-2.003"
            strokeLinejoin="miter"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="square"
            strokeMiterlimit="10"
            d="M23.778,16.222 C21.788,14.231,19.038,13,16,13c-3.038,0-5.788,1.231-7.778,3.222"
            strokeLinejoin="miter"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="square"
            strokeMiterlimit="10"
            d="M29.612,10.638 C26.128,7.155,21.316,5,16,5C10.684,5,5.872,7.155,2.388,10.638"
            strokeLinejoin="miter"
          />
          <line
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="square"
            strokeMiterlimit="10"
            x1="5"
            y1="27"
            x2="29"
            y2="3"
            strokeLinejoin="miter"
          />
        </svg>
        <span className="offline-indicator-banner-text">
          {t('offline.noConnection', 'Нет подключения к интернету')}
        </span>
      </div>
    </div>
  )
}
