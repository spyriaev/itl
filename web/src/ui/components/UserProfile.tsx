"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"
import { getUserUsage, getUserPlan, setUserPlan, formatBytes, calculatePercentage, type UserUsage as UserUsageType, type UserPlan } from "../../services/limitService"
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

  useEffect(() => {
    loadData()
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
      <div className="profile-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={styles.spinner}></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="profile-container">
        <div style={styles.error}>{error}</div>
        <button onClick={loadData} className="button-primary" style={{ marginTop: '16px' }}>
          {t("profile.retry")}
        </button>
      </div>
    )
  }

  if (!usage || !plan) {
    return <div className="profile-container">{t("profile.noData")}</div>
  }

  const storagePercent = calculatePercentage(usage.storageBytesUsed, usage.limits.maxStorageBytes)
  const tokensPercent = calculatePercentage(usage.tokensUsed, usage.limits.maxTokensPerMonth)
  const questionsPercent = calculatePercentage(usage.questionsCount, usage.limits.maxQuestionsPerMonth)
  const filesPercent = usage.limits.maxFiles ? calculatePercentage(usage.filesCount, usage.limits.maxFiles) : 0

  return (
    <div className="profile-container" style={styles.container}>
      <div style={styles.header}>
        <h1 className="text-heading-large" style={styles.title}>{t("profile.title")}</h1>
        <button
          onClick={() => navigate('/app')}
          style={styles.closeButton}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f3f4f6'
            e.currentTarget.style.color = '#171a1f'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = '#6e7787'
          }}
          aria-label={t("profile.close")}
          title={t("profile.close")}
        >
          <svg
            width="24"
            height="24"
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
      </div>
      
      {/* Current Plan Section */}
      <div style={styles.section}>
        <h2 className="text-heading-medium" style={styles.sectionTitle}>{t("profile.currentPlan")}</h2>
        <div style={styles.planSelector}>
          {(['beta', 'base', 'plus'] as const).map((planType) => (
            <button
              key={planType}
              onClick={() => handlePlanChange(planType)}
              disabled={changingPlan || plan.planType === planType}
              className={plan.planType === planType ? "button-primary" : "button-secondary"}
              style={{
                ...styles.planButton,
                ...(plan.planType === planType ? styles.planButtonActive : {}),
              }}
            >
              {t(`plans.${planType}.title`)}
            </button>
          ))}
        </div>
        <p style={styles.planInfo}>
          {t("profile.planStarted")}: {new Date(plan.startedAt).toLocaleDateString()}
        </p>
        <p style={styles.periodInfo}>
          {t("profile.periodReset")}: {new Date(usage.periodEnd).toLocaleDateString()}
        </p>
      </div>

      {/* Usage Statistics */}
      <div style={styles.section}>
        <h2 className="text-heading-medium" style={styles.sectionTitle}>{t("profile.usageTitle")}</h2>
        
        {/* Storage Usage */}
        <div style={styles.usageItem}>
          <div style={styles.usageHeader}>
            <span style={styles.usageLabel}>{t("profile.storage")}</span>
            <span style={styles.usageValue}>
              {formatBytes(usage.storageBytesUsed)} / {formatBytes(usage.limits.maxStorageBytes)}
            </span>
          </div>
          <div style={styles.progressBarContainer}>
            <div style={{...styles.progressBar, width: `${storagePercent}%`, backgroundColor: storagePercent > 90 ? '#ef4444' : storagePercent > 70 ? '#f59e0b' : '#2d66f5'}}></div>
          </div>
          <span style={styles.usagePercent}>{storagePercent}%</span>
        </div>

        {/* Files Count */}
        {usage.limits.maxFiles && (
          <div style={styles.usageItem}>
            <div style={styles.usageHeader}>
              <span style={styles.usageLabel}>{t("profile.files")}</span>
              <span style={styles.usageValue}>
                {usage.filesCount} / {usage.limits.maxFiles}
              </span>
            </div>
            <div style={styles.progressBarContainer}>
              <div style={{...styles.progressBar, width: `${filesPercent}%`, backgroundColor: filesPercent > 90 ? '#ef4444' : filesPercent > 70 ? '#f59e0b' : '#2d66f5'}}></div>
            </div>
            <span style={styles.usagePercent}>{filesPercent}%</span>
          </div>
        )}

        {/* Single File Size Limit */}
        <div style={styles.usageItem}>
          <div style={styles.usageHeader}>
            <span style={styles.usageLabel}>{t("profile.maxFileSize")}</span>
            <span style={styles.usageValue}>
              {formatBytes(usage.limits.maxSingleFileBytes)}
            </span>
          </div>
        </div>

        {/* Tokens Usage */}
        <div style={styles.usageItem}>
          <div style={styles.usageHeader}>
            <span style={styles.usageLabel}>{t("profile.tokens")}</span>
            <span style={styles.usageValue}>
              {usage.tokensUsed.toLocaleString()} / {usage.limits.maxTokensPerMonth.toLocaleString()}
            </span>
          </div>
          <div style={styles.progressBarContainer}>
            <div style={{...styles.progressBar, width: `${tokensPercent}%`, backgroundColor: tokensPercent > 90 ? '#ef4444' : tokensPercent > 70 ? '#f59e0b' : '#2d66f5'}}></div>
          </div>
          <span style={styles.usagePercent}>{tokensPercent}%</span>
        </div>

        {/* Questions Usage */}
        <div style={styles.usageItem}>
          <div style={styles.usageHeader}>
            <span style={styles.usageLabel}>{t("profile.questions")}</span>
            <span style={styles.usageValue}>
              {usage.questionsCount} / {usage.limits.maxQuestionsPerMonth}
            </span>
          </div>
          <div style={styles.progressBarContainer}>
            <div style={{...styles.progressBar, width: `${questionsPercent}%`, backgroundColor: questionsPercent > 90 ? '#ef4444' : questionsPercent > 70 ? '#f59e0b' : '#2d66f5'}}></div>
          </div>
          <span style={styles.usagePercent}>{questionsPercent}%</span>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
  },
  title: {
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '6px',
    color: '#6e7787',
    transition: 'all 0.2s',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  },
  sectionTitle: {
    marginBottom: '20px',
    color: '#171a1f',
  },
  planSelector: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  planButton: {
    padding: '12px 24px',
    borderRadius: '6px',
    border: '1px solid #dee1e6',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  planButtonActive: {
    backgroundColor: '#2d66f5',
    color: '#ffffff',
    borderColor: '#2d66f5',
  },
  planInfo: {
    fontSize: '14px',
    color: '#6e7787',
    marginBottom: '8px',
  },
  periodInfo: {
    fontSize: '14px',
    color: '#6e7787',
  },
  usageItem: {
    marginBottom: '24px',
  },
  usageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  usageLabel: {
    fontSize: '15px',
    fontWeight: 500,
    color: '#171a1f',
  },
  usageValue: {
    fontSize: '14px',
    color: '#6e7787',
  },
  progressBarContainer: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e0e7ff',
    borderRadius: '4px',
    overflow: 'hidden',
    marginBottom: '4px',
  },
  progressBar: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  usagePercent: {
    fontSize: '12px',
    color: '#6e7787',
  },
  error: {
    padding: '16px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: '6px',
    marginBottom: '16px',
  },
  spinner: {
    border: '3px solid #e0e7ff',
    borderTop: '3px solid #2d66f5',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    animation: 'spin 1s linear infinite',
  },
}

