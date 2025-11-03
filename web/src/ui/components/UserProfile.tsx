"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"
import { getUserUsage, getUserPlan, setUserPlan, formatBytes, calculatePercentage, type UserUsage as UserUsageType, type UserPlan } from "../../services/limitService"
import { getCacheStats, clearCache, initCache } from "../../services/pdfCache"
import "../styles/upload-page.css"

export function UserProfile() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [usage, setUsage] = useState<UserUsageType | null>(null)
  const [plan, setPlan] = useState<UserPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [changingPlan, setChangingPlan] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [cacheStats, setCacheStats] = useState<{ fileCount: number; totalSizeMB: number; maxSizeMB: number; availableSizeMB: number } | null>(null)
  const [clearingCache, setClearingCache] = useState(false)
  const [activeSection, setActiveSection] = useState<'usage' | 'cache'>('usage')

  useEffect(() => {
    loadData()
    loadCacheStats()
  }, [])

  const loadCacheStats = async () => {
    try {
      await initCache()
      const stats = await getCacheStats()
      setCacheStats({
        fileCount: stats.fileCount,
        totalSizeMB: stats.totalSizeMB,
        maxSizeMB: stats.maxSizeMB,
        availableSizeMB: stats.availableSizeMB
      })
    } catch (error) {
      console.error('Failed to load cache stats:', error)
    }
  }

  const handleClearCache = async () => {
    if (!confirm(t("profile.cacheClearConfirm"))) {
      return
    }

    try {
      setClearingCache(true)
      await clearCache()
      await loadCacheStats()
      alert(t("profile.cacheCleared"))
    } catch (error) {
      console.error('Failed to clear cache:', error)
      alert(t("profile.cacheClearError"))
    } finally {
      setClearingCache(false)
    }
  }

  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth
      setIsMobile(width < 768)
      setIsTablet(width >= 768 && width < 1024)
    }
    
    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      const [usageData, planData] = await Promise.all([
        getUserUsage(),
        getUserPlan()
      ])
      setUsage(usageData)
      setPlan(planData)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profile.loadError"))
    } finally {
      setLoading(false)
    }
  }

  const handlePlanChange = async (newPlanType: 'beta' | 'base' | 'plus') => {
    if (plan?.planType === newPlanType) return
    
    try {
      setChangingPlan(true)
      const newPlan = await setUserPlan(newPlanType)
      setPlan(newPlan)
      // Reload usage to get updated limits
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profile.planChangeError"))
    } finally {
      setChangingPlan(false)
    }
  }

  if (!user) {
    return <div className="profile-container">{t("profile.notAuthenticated")}</div>
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.mainContainer}>
        <div style={styles.error}>{error}</div>
        <button onClick={loadData} style={styles.retryButton}>
          {t("profile.retry")}
        </button>
      </div>
    )
  }

  if (!usage || !plan) {
    return <div style={styles.mainContainer}>{t("profile.noData")}</div>
  }

  const getUserInitials = () => {
    if (user.email) {
      return user.email.substring(0, 1).toUpperCase()
    }
    return "U"
  }

  const getUserDisplayName = () => {
    return user.email || "User"
  }

  const getPlanDisplayName = () => {
    const planNames: Record<string, string> = {
      beta: "Beta Plan",
      base: "Base Plan",
      plus: "Plus Plan"
    }
    return planNames[plan.planType] || plan.planType
  }

  const storagePercent = calculatePercentage(usage.storageBytesUsed, usage.limits.maxStorageBytes)
  const tokensPercent = calculatePercentage(usage.tokensUsed, usage.limits.maxTokensPerMonth)
  const questionsPercent = calculatePercentage(usage.questionsCount, usage.limits.maxQuestionsPerMonth)
  const filesPercent = usage.limits.maxFiles ? calculatePercentage(usage.filesCount, usage.limits.maxFiles) : 0

  // Available plans for upgrade (excluding current)
  const availablePlans = ['base', 'plus'].filter(p => p !== plan.planType)

  return (
    <div style={styles.container}>
      {/* Close Button */}
      <button
        onClick={() => navigate('/app')}
        style={{
          ...styles.closeButton,
          ...(isMobile ? styles.closeButtonMobile : {}),
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
        aria-label={t("profile.close")}
        title={t("profile.close")}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      {/* Mobile Sidebar Overlay */}
      {isMobile && sidebarOpen && (
        <div 
          style={styles.sidebarOverlay}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div style={{
        ...styles.sidebar,
        ...(isMobile ? {
          ...styles.sidebarMobile,
          ...(sidebarOpen ? styles.sidebarMobileOpen : styles.sidebarMobileClosed)
        } : {}),
        ...(isTablet ? styles.sidebarTablet : {}),
      }}>
        <div style={styles.sidebarContent}>
          {/* Mobile Menu Button */}
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              style={styles.sidebarCloseButton}
              aria-label="Close menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}

          {/* User Info */}
          <div style={styles.userInfo}>
            <div style={styles.userInfoHeader}>
              <div style={styles.userInitials}>{getUserInitials()}</div>
              <div style={styles.userDetails}>
                <div style={styles.userName}>{getUserDisplayName()}</div>
                <div style={styles.userPlanEmail}>
                  <span>{getPlanDisplayName()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav style={styles.nav}>
            <a 
              href="#" 
              onClick={(e) => { 
                e.preventDefault()
                setActiveSection('usage')
                if (isMobile) setSidebarOpen(false)
              }}
              style={activeSection === 'usage' ? styles.navItemActive : styles.navItem}
              onMouseEnter={(e) => {
                if (activeSection !== 'usage') {
                  Object.assign(e.currentTarget.style, styles.navItemHover)
                }
              }}
              onMouseLeave={(e) => {
                if (activeSection !== 'usage') {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'rgba(0, 0, 0, 0.6)'
                }
              }}
            >
              <span style={styles.navIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
              </span>
              <span>{t("profile.usage")}</span>
            </a>
            <a 
              href="#" 
              onClick={(e) => { 
                e.preventDefault()
                setActiveSection('cache')
                if (isMobile) setSidebarOpen(false)
              }}
              style={activeSection === 'cache' ? styles.navItemActive : styles.navItem}
              onMouseEnter={(e) => {
                if (activeSection !== 'cache') {
                  Object.assign(e.currentTarget.style, styles.navItemHover)
                }
              }}
              onMouseLeave={(e) => {
                if (activeSection !== 'cache') {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'rgba(0, 0, 0, 0.6)'
                }
              }}
            >
              <span style={styles.navIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <path d="M9 9h6v6H9z"></path>
                </svg>
              </span>
              <span>{t("profile.cache")}</span>
            </a>
          </nav>

        </div>
      </div>

      {/* Main Content */}
      <div style={{
        ...styles.mainContent,
        ...(isMobile ? styles.mainContentMobile : {}),
        ...(isTablet ? styles.mainContentTablet : {}),
      }}>
        {/* Mobile Menu Button */}
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={styles.mobileMenuButton}
            aria-label="Open menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        )}

        <div style={styles.contentWrapper}>
          {activeSection === 'usage' && (
            <>
              {/* Upgrade Cards */}
              {availablePlans.length > 0 && (
                <div style={{
                  ...styles.upgradeGrid,
                  ...(isMobile ? styles.upgradeGridMobile : {}),
                  ...(isTablet ? styles.upgradeGridTablet : {}),
                }}>
                  {availablePlans.map((planType) => (
                    <div key={planType} style={styles.upgradeCard}>
                      <div style={styles.upgradeCardContent}>
                        <div style={styles.upgradeCardHeader}>
                          <div style={styles.upgradeCardTitle}>{t(`plans.${planType}.title`)}</div>
                          <div style={styles.upgradeCardDescription}>
                            {t(`plans.${planType}.description`) || `Upgrade to ${planType}`}
                          </div>
                        </div>
                        <button
                          onClick={() => handlePlanChange(planType as 'beta' | 'base' | 'plus')}
                          disabled={changingPlan}
                          style={styles.upgradeButton}
                          onMouseEnter={(e) => {
                            if (!changingPlan) {
                              Object.assign(e.currentTarget.style, styles.upgradeButtonHover)
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#2d66f5'
                            e.currentTarget.style.transform = 'none'
                          }}
                        >
                          {t("profile.upgrade")} to {t(`plans.${planType}.title`)}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Current Plan Card */}
              <div style={styles.currentPlanCard}>
                <div style={{
                  ...styles.currentPlanGrid,
                  ...(isMobile ? styles.currentPlanGridMobile : {}),
                  ...(isTablet ? styles.currentPlanGridTablet : {}),
                }}>
                  <div style={styles.currentPlanLeft}>
                    <div style={styles.currentPlanHeader}>
                      <div style={styles.currentPlanTitle}>
                        {getPlanDisplayName()}
                        <span style={styles.currentBadge}>{t("profile.current")}</span>
                      </div>
                      <div style={styles.currentPlanDescription}>
                        {t("profile.planStarted")}: {new Date(plan.startedAt).toLocaleDateString()}
                      </div>
                      <div style={styles.currentPlanDescription}>
                        {t("profile.periodReset")}: {new Date(usage.periodEnd).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div style={styles.currentPlanRight}>
                    <div style={styles.usageCard}>
                      <div style={styles.usageCardHeader}>
                        <div style={styles.usageCardTitle}>{t("profile.usageTitle")}</div>
                      </div>
                      <div style={styles.usageCardContent}>
                        {/* Storage */}
                        <div style={styles.usageStat}>
                          <div style={styles.usageStatHeader}>
                            <span>{t("profile.storage")}</span>
                            <span>{formatBytes(usage.storageBytesUsed)} / {formatBytes(usage.limits.maxStorageBytes)}</span>
                          </div>
                          <div style={styles.progressBarContainer}>
                            <div style={{...styles.progressBar, width: `${storagePercent}%`}}></div>
                          </div>
                        </div>

                        {/* Files */}
                        {usage.limits.maxFiles && (
                          <div style={styles.usageStat}>
                            <div style={styles.usageStatHeader}>
                              <span>{t("profile.files")}</span>
                              <span>{usage.filesCount} / {usage.limits.maxFiles}</span>
                            </div>
                            <div style={styles.progressBarContainer}>
                              <div style={{...styles.progressBar, width: `${filesPercent}%`}}></div>
                            </div>
                          </div>
                        )}

                        {/* Tokens */}
                        <div style={styles.usageStat}>
                          <div style={styles.usageStatHeader}>
                            <span>{t("profile.tokens")}</span>
                            <span>{usage.tokensUsed.toLocaleString()} / {usage.limits.maxTokensPerMonth.toLocaleString()}</span>
                          </div>
                          <div style={styles.progressBarContainer}>
                            <div style={{...styles.progressBar, width: `${tokensPercent}%`}}></div>
                          </div>
                        </div>

                        {/* Questions */}
                        <div style={styles.usageStat}>
                          <div style={styles.usageStatHeader}>
                            <span>{t("profile.questions")}</span>
                            <span>{usage.questionsCount} / {usage.limits.maxQuestionsPerMonth}</span>
                          </div>
                          <div style={styles.progressBarContainer}>
                            <div style={{...styles.progressBar, width: `${questionsPercent}%`}}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeSection === 'cache' && cacheStats !== null && (
            <div style={styles.cacheSection}>
              <div style={styles.cacheCard}>
                <div style={styles.cacheCardHeader}>
                  <div style={styles.cacheCardTitle}>{t("profile.cacheTitle")}</div>
                  <div style={styles.cacheCardDescription}>
                    {t("profile.cacheDescription")}
                  </div>
                </div>
                <div style={styles.cacheCardContent}>
                  <div style={styles.cacheStats}>
                    <div style={styles.cacheStat}>
                      <span style={styles.cacheStatLabel}>{t("profile.cacheFiles")}:</span>
                      <span style={styles.cacheStatValue}>{cacheStats.fileCount}</span>
                    </div>
                    <div style={styles.cacheStat}>
                      <span style={styles.cacheStatLabel}>{t("profile.cacheSize")}:</span>
                      <span style={styles.cacheStatValue}>
                        {cacheStats.totalSizeMB.toFixed(2)} MB / {cacheStats.maxSizeMB} MB
                      </span>
                    </div>
                    <div style={styles.cacheStat}>
                      <span style={styles.cacheStatLabel}>{t("profile.cacheAvailable")}:</span>
                      <span style={styles.cacheStatValue}>
                        {cacheStats.availableSizeMB.toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                  <div style={styles.cacheProgressContainer}>
                    <div style={{
                      ...styles.cacheProgressBar,
                      width: `${Math.min(100, (cacheStats.totalSizeMB / cacheStats.maxSizeMB) * 100)}%`
                    }}></div>
                  </div>
                  <button
                    onClick={handleClearCache}
                    disabled={clearingCache || cacheStats.fileCount === 0}
                    style={{
                      ...styles.cacheClearButton,
                      ...((clearingCache || cacheStats.fileCount === 0) ? styles.cacheClearButtonDisabled : {})
                    }}
                    onMouseEnter={(e) => {
                      if (!clearingCache && cacheStats.fileCount > 0) {
                        e.currentTarget.style.backgroundColor = '#dc2626'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!clearingCache && cacheStats.fileCount > 0) {
                        e.currentTarget.style.backgroundColor = '#ef4444'
                      }
                    }}
                  >
                    {clearingCache ? t("profile.cacheClearing") : t("profile.cacheClear")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flex: 1,
    minHeight: '100vh',
    backgroundColor: '#ffffff',
    color: '#171a1f',
    fontFamily: '"SF Pro Display", "SF Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: '24px',
    right: '24px',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'rgba(0, 0, 0, 0.6)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    zIndex: 10,
  },
  sidebar: {
    width: '256px',
    borderRight: '1px solid rgba(0, 0, 0, 0.1)',
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#fafafa',
  },
  sidebarContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  userInfo: {
    padding: '8px',
  },
  userInfoHeader: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
  },
  userInitials: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    backgroundColor: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 500,
    color: '#171a1f',
    flexShrink: 0,
  },
  userDetails: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#171a1f',
    marginBottom: '4px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userPlanEmail: {
    fontSize: '14px',
    color: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  separator: {
    margin: '0 4px',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    borderRadius: '6px',
    color: 'rgba(0, 0, 0, 0.6)',
    textDecoration: 'none',
    fontSize: '14px',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  navItemHover: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    color: '#171a1f',
  },
  navItemActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    borderRadius: '6px',
    color: '#171a1f',
    textDecoration: 'none',
    fontSize: '14px',
    backgroundColor: '#f0f4ff',
    fontWeight: 500,
    cursor: 'default',
  },
  navIcon: {
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainContent: {
    flex: 1,
    padding: '64px 36px',
    overflow: 'auto',
    backgroundColor: '#ffffff',
  },
  contentWrapper: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  upgradeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '24px',
    marginBottom: '24px',
  },
  upgradeCard: {
    borderRadius: '12px',
    padding: '24px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  upgradeCardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  upgradeCardHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  upgradeCardTitle: {
    fontSize: '16px',
    fontWeight: 500,
    color: '#171a1f',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  upgradeCardDescription: {
    fontSize: '14px',
    color: 'rgba(0, 0, 0, 0.6)',
    lineHeight: '1.5',
  },
  upgradeButton: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#2d66f5',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    marginTop: '16px',
    width: 'fit-content',
  },
  upgradeButtonHover: {
    backgroundColor: '#2563eb',
    transform: 'translateY(-1px)',
  },
  currentPlanCard: {
    borderRadius: '12px',
    padding: '24px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  currentPlanGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
  },
  currentPlanLeft: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  currentPlanHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  currentPlanTitle: {
    fontSize: '16px',
    fontWeight: 500,
    color: '#171a1f',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  currentBadge: {
    fontSize: '12px',
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: '4px',
    backgroundColor: 'rgba(45, 102, 245, 0.1)',
    color: '#2d66f5',
  },
  currentPlanDescription: {
    fontSize: '14px',
    color: 'rgba(0, 0, 0, 0.6)',
    marginBottom: '4px',
  },
  currentPlanRight: {
    display: 'flex',
    flexDirection: 'column',
  },
  usageCard: {
    borderRadius: '12px',
    padding: '12px 16px',
    backgroundColor: '#f8f9fa',
    border: '1px solid rgba(0, 0, 0, 0.05)',
  },
  usageCardHeader: {
    marginBottom: '16px',
  },
  usageCardTitle: {
    fontSize: '16px',
    fontWeight: 500,
    color: '#171a1f',
  },
  usageCardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  usageStat: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  usageStatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
    color: 'rgba(0, 0, 0, 0.8)',
  },
  progressBarContainer: {
    width: '100%',
    height: '4px',
    backgroundColor: '#e5e7eb',
    borderRadius: '2px',
    overflow: 'hidden',
    backgroundImage: 'radial-gradient(circle, rgb(229, 231, 235) 2px, transparent 2px)',
    backgroundSize: '8px 4px',
    backgroundPosition: '0px center',
    backgroundRepeat: 'repeat-x',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#2d66f5',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#ffffff',
  },
  error: {
    padding: '16px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: '8px',
    marginBottom: '16px',
    border: '1px solid rgba(220, 38, 38, 0.2)',
  },
  retryButton: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#2d66f5',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    marginTop: '16px',
  },
  mainContainer: {
    padding: '64px 36px',
    backgroundColor: '#ffffff',
    color: '#171a1f',
    minHeight: '100vh',
  },
  spinner: {
    border: '3px solid rgba(0, 0, 0, 0.1)',
    borderTop: '3px solid #2d66f5',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
  },
  cacheSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  cacheCard: {
    borderRadius: '12px',
    padding: '24px',
    backgroundColor: '#ffffff',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  cacheCardHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '16px',
  },
  cacheCardTitle: {
    fontSize: '16px',
    fontWeight: 500,
    color: '#171a1f',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  cacheCardDescription: {
    fontSize: '14px',
    color: 'rgba(0, 0, 0, 0.6)',
    lineHeight: '1.5',
  },
  cacheCardContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  cacheStats: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  cacheStat: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '14px',
  },
  cacheStatLabel: {
    color: 'rgba(0, 0, 0, 0.6)',
  },
  cacheStatValue: {
    color: '#171a1f',
    fontWeight: 500,
  },
  cacheProgressContainer: {
    width: '100%',
    height: '8px',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  cacheProgressBar: {
    height: '100%',
    backgroundColor: '#2d66f5',
    transition: 'width 0.3s ease',
  },
  cacheClearButton: {
    padding: '12px 16px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
    alignSelf: 'flex-start',
  },
  cacheClearButtonDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    color: 'rgba(0, 0, 0, 0.4)',
    cursor: 'not-allowed',
  },
  // Mobile styles
  sidebarOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 998,
  },
  sidebarMobile: {
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100vh',
    zIndex: 999,
    transition: 'transform 0.3s ease',
    boxShadow: '2px 0 8px rgba(0, 0, 0, 0.1)',
  },
  sidebarMobileOpen: {
    transform: 'translateX(0)',
  },
  sidebarMobileClosed: {
    transform: 'translateX(-100%)',
  },
  sidebarTablet: {
    width: '200px',
  },
  sidebarCloseButton: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'rgba(0, 0, 0, 0.6)',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  mobileMenuButton: {
    position: 'absolute',
    top: '16px',
    left: '16px',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'rgba(0, 0, 0, 0.6)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    zIndex: 10,
  },
  closeButtonMobile: {
    top: '16px',
    right: '16px',
    width: '36px',
    height: '36px',
  },
  mainContentMobile: {
    padding: '56px 16px 24px',
    width: '100%',
  },
  mainContentTablet: {
    padding: '72px 24px 48px',
  },
  upgradeGridMobile: {
    gridTemplateColumns: '1fr',
    gap: '16px',
  },
  upgradeGridTablet: {
    gridTemplateColumns: '1fr',
    gap: '20px',
  },
  currentPlanGridMobile: {
    gridTemplateColumns: '1fr',
    gap: '16px',
  },
  currentPlanGridTablet: {
    gridTemplateColumns: '1fr',
    gap: '20px',
  },
}

