import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { LandingHeader } from './LandingHeader'
import { LandingFooter } from './LandingFooter'
import { AuthModal } from './AuthModal'
import '../styles/landing.css'
import '../styles/typography.css'
import '../styles/buttons.css'

export function PlansPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [isMonthly, setIsMonthly] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)

  const handleTryClick = () => {
    setShowAuthModal(true)
  }

  const handleAuthSuccess = () => {
    setShowAuthModal(false)
    setTimeout(() => {
      navigate('/app')
    }, 100)
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
      </div>
    )
  }

  // Pricing data
  const plans = [
    {
      id: 'beta',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#2D66F5" stroke="#2D66F5" strokeWidth="1.5"/>
        </svg>
      ),
      title: t('plans.betaAccess.title'),
      description: t('plans.betaAccess.description'),
      features: [
        t('plans.betaAccess.feature1'),
        t('plans.betaAccess.feature2'),
        t('plans.betaAccess.feature3'),
        t('plans.betaAccess.feature4'),
      ],
      monthlyPrice: 0,
      yearlyPrice: 0,
      buttonText: t('plans.betaAccess.button'),
      buttonClass: 'button-primary',
      badge: t('landing.soon'),
      highlight: false,
    },
    {
      id: 'base',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="#2D66F5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <path d="M9 22V12H15V22" stroke="#2D66F5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      ),
      title: t('plans.base.title'),
      description: t('plans.base.description'),
      features: [
        t('plans.base.feature1'),
        t('plans.base.feature2'),
        t('plans.base.feature3'),
        t('plans.base.feature4'),
      ],
      monthlyPrice: 3,
      yearlyPrice: 25.2, // 30% discount
      buttonText: t('plans.base.button'),
      buttonClass: 'button-secondary',
      badge: t('landing.soon'),
      highlight: false,
    },
    {
      id: 'plus',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="4" width="20" height="16" rx="2" stroke="#2D66F5" strokeWidth="1.5" fill="none"/>
          <path d="M7 8H17M7 12H17M7 16H13" stroke="#2D66F5" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
      title: t('plans.plus.title'),
      description: t('plans.plus.description'),
      features: [
        t('plans.plus.feature1'),
        t('plans.plus.feature2'),
        t('plans.plus.feature3'),
        t('plans.plus.feature4'),
      ],
      monthlyPrice: 5,
      yearlyPrice: 42, // 30% discount
      buttonText: t('plans.plus.button'),
      buttonClass: 'button-secondary',
      badge: t('plans.plus.badge'),
      highlight: true,
    },
  ]

  return (
    <>
      <LandingHeader onTryClick={handleTryClick} />
      <div style={styles.container} data-plans-page>
        {/* Title Section */}
        <div style={styles.titleSection} data-plans-title-section>
          <h1 className="text-heading-large" style={styles.mainTitle} data-plans-title>
            {t('plans.title')}
          </h1>
          <p className="text-body" style={styles.subtitle} data-plans-subtitle>
            {t('plans.subtitle')}
          </p>
          <p style={styles.offerText} data-plans-offer>
            <strong>{t('plans.trialText')}</strong> {t('plans.trialDetails')}
          </p>
        </div>

        {/* Billing Toggle */}
        <div style={styles.billingToggleContainer} data-plans-billing>
          <div style={styles.billingToggle} data-plans-billing-toggle>
            <button
              style={{
                ...styles.billingOption,
                ...(isMonthly ? styles.billingOptionActive : {}),
              }}
              onClick={() => setIsMonthly(true)}
              data-plans-monthly
            >
              {t('plans.monthlyBilling')}
            </button>
            <button
              style={{
                ...styles.billingOption,
                ...(!isMonthly ? styles.billingOptionActive : {}),
              }}
              onClick={() => setIsMonthly(false)}
              data-plans-yearly
            >
              {t('plans.yearlyBilling')}
            </button>
          </div>
          {!isMonthly && (
            <p style={styles.savingsText} data-plans-savings>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={styles.savingsArrow}>
                <path d="M2 8C2 8 5 5 8 5C11 5 14 8 14 8" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M14 8L12 6" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 8L12 10" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {t('plans.saveUpTo')}
            </p>
          )}
        </div>

        {/* Pricing Cards */}
        <div style={styles.cardsContainer} data-plans-cards>
          {plans.map((plan) => (
            <div
              key={plan.id}
              style={{
                ...styles.card,
                ...(plan.highlight ? styles.cardHighlight : {}),
              }}
              data-plan-card
            >
              {plan.badge && (
                <div style={styles.badge} data-plan-badge>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#F59E0B"/>
                  </svg>
                  <span>{plan.badge}</span>
                </div>
              )}
              <div style={styles.cardIcon} data-plan-icon>
                {plan.icon}
              </div>
              <h2 style={styles.cardTitle} data-plan-title>{plan.title}</h2>
              <p style={styles.cardDescription} data-plan-description>{plan.description}</p>
              <ul style={styles.featuresList} data-plan-features>
                {plan.features.map((feature, index) => (
                  <li key={index} style={styles.featureItem}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={styles.checkIcon}>
                      <path d="M13.3333 4L6 11.3333L2.66667 8" stroke="#EC4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <div style={styles.priceContainer} data-plan-price>
                <span style={styles.price}>
                  ${isMonthly ? plan.monthlyPrice.toFixed(2) : plan.yearlyPrice.toFixed(2)}
                  {plan.yearlyPrice > 0 && !isMonthly && (
                    <span style={styles.priceSmall}> (${(plan.yearlyPrice / 12).toFixed(2)}{t('plans.perMonth')})</span>
                  )}
                </span>
                <span style={styles.pricePeriod}>
                  {isMonthly ? t('plans.perMonth') : t('plans.perYear')}
                </span>
              </div>
              <button
                className={plan.buttonClass}
                style={styles.cardButton}
                onClick={handleTryClick}
                data-plan-button
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>
      </div>
      <LandingFooter />
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} onAuthSuccess={handleAuthSuccess} />
      )}
    </>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    width: '100vw',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #f3f3f3',
    borderTop: '4px solid #2D66F5',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  container: {
    minHeight: 'calc(100vh - 200px)',
    padding: '80px 32px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  titleSection: {
    textAlign: 'center',
    marginBottom: '48px',
  },
  mainTitle: {
    marginBottom: '16px',
    color: '#1F2937',
  },
  subtitle: {
    marginBottom: '24px',
    color: '#565E6C',
  },
  offerText: {
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '14px',
    lineHeight: '22px',
    color: '#565E6C',
    marginBottom: '32px',
  },
  billingToggleContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '48px',
    gap: '12px',
  },
  billingToggle: {
    display: 'flex',
    backgroundColor: '#F9FAFB',
    borderRadius: '8px',
    padding: '4px',
    gap: '0',
  },
  billingOption: {
    padding: '8px 24px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '14px',
    lineHeight: '22px',
    fontWeight: '400',
    color: '#565E6C',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  billingOptionActive: {
    backgroundColor: '#22C55E',
    color: '#FFFFFF',
    fontWeight: '500',
  },
  savingsText: {
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '14px',
    lineHeight: '22px',
    color: '#22C55E',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  savingsArrow: {
    flexShrink: 0,
  },
  cardsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
    alignItems: 'stretch',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: '8px',
    padding: '32px',
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.1)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
  },
  cardHighlight: {
    border: '2px solid #2D66F5',
  },
  badge: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    backgroundColor: '#FEF3C7',
    padding: '4px 8px',
    borderRadius: '4px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: '500',
    color: '#92400E',
  },
  cardIcon: {
    marginBottom: '16px',
  },
  cardTitle: {
    fontFamily: "'Red Hat Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '24px',
    lineHeight: '32px',
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: '8px',
    marginTop: 0,
  },
  cardDescription: {
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '14px',
    lineHeight: '22px',
    color: '#565E6C',
    marginBottom: '24px',
    marginTop: 0,
  },
  featuresList: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 24px 0',
    flex: 1,
  },
  featureItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '16px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '14px',
    lineHeight: '22px',
    color: '#1F2937',
  },
  checkIcon: {
    flexShrink: 0,
    marginTop: '3px',
  },
  priceContainer: {
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  price: {
    fontFamily: "'Red Hat Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '32px',
    lineHeight: '40px',
    fontWeight: '700',
    color: '#1F2937',
  },
  priceSmall: {
    fontSize: '18px',
    lineHeight: '24px',
    color: '#9CA3AF',
    marginLeft: '4px',
  },
  pricePeriod: {
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '14px',
    lineHeight: '22px',
    color: '#565E6C',
  },
  cardButton: {
    width: '100%',
    marginTop: 'auto',
  },
}

