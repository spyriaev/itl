import React from 'react'
import { useTranslation } from 'react-i18next'
import '../styles/buttons.css'
import '../styles/typography.css'

export function FeaturesSection() {
  const { t } = useTranslation()

  return (
    <section style={styles.section} data-features-section>
      <div style={styles.container}>
        <div style={styles.header}>
          <h2 style={styles.title} data-features-title>{t("landing.featuresTitle")}</h2>
        </div>
        <div style={styles.grid} data-features-grid>
          {/* Feature 1 */}
          <div style={styles.cardWrapper}>
            <a href="#" style={styles.card} data-feature-card>
              <div style={styles.cardContent}>
                <div>
                  <h3 style={styles.cardTitle}>{t("landing.feature1Title")}</h3>
                  <p style={styles.cardDescription}>{t("landing.feature1Desc")}</p>
                </div>
                <div style={styles.cardLink}>
                  <span style={styles.linkText} className="link-text">Explore features ↗</span>
                </div>
              </div>
              <figure style={styles.figure}>
                <div style={styles.mediaContainer} className="media-container">
                  <div style={styles.mediaInner}>
                    <picture style={styles.picture}>
                      <img 
                        src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=640&q=80" 
                        alt="Feature illustration" 
                        style={styles.image}
                        loading="lazy"
                      />
                    </picture>
                  </div>
                </div>
              </figure>
            </a>
          </div>

          {/* Feature 2 */}
          <div style={styles.cardWrapper}>
            <a href="#" style={styles.card} data-feature-card>
              <div style={styles.cardContent}>
                <div>
                  <h3 style={styles.cardTitle}>{t("landing.feature2Title")}</h3>
                  <p style={styles.cardDescription}>{t("landing.feature2Desc")}</p>
                </div>
                <div style={styles.cardLink}>
                  <span style={styles.linkText} className="link-text">Learn more ↗</span>
                </div>
              </div>
              <figure style={styles.figure}>
                <div style={styles.mediaContainer} className="media-container">
                  <div style={styles.mediaInner}>
                    <picture style={styles.picture}>
                      <img 
                        src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=640&q=80" 
                        alt="Feature illustration" 
                        style={styles.image}
                        loading="lazy"
                      />
                    </picture>
                  </div>
                </div>
              </figure>
            </a>
          </div>

          {/* Feature 3 */}
          <div style={styles.cardWrapper}>
            <a href="#" style={styles.card} data-feature-card>
              <div style={styles.cardContent}>
                <div>
                  <h3 style={styles.cardTitle}>{t("landing.feature3Title")}</h3>
                  <p style={styles.cardDescription}>{t("landing.feature3Desc")}</p>
                </div>
                <div style={styles.cardLink}>
                  <span style={styles.linkText} className="link-text">Try it now →</span>
                </div>
              </div>
              <figure style={styles.figure}>
                <div style={styles.mediaContainer} className="media-container">
                  <div style={styles.mediaInner}>
                    <picture style={styles.picture}>
                      <img 
                        src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=640&q=80" 
                        alt="Feature illustration" 
                        style={styles.image}
                        loading="lazy"
                      />
                    </picture>
                  </div>
                </div>
              </figure>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  section: {
    backgroundColor: 'white',
    color: '#171A1F',
    padding: '40px 0 80px 0',
    width: '100%',
  },
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '0 32px',
  },
  header: {
    textAlign: 'left',
    marginBottom: '40px',
    maxWidth: '600px',
  },
  title: {
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '48px',
    lineHeight: '56px',
    fontWeight: '700',
    color: '#171A1F',
    margin: 0,
    textWrap: 'balance',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '16px',
    alignItems: 'stretch',
  },
  cardWrapper: {
    height: '100%',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'white',
    borderRadius: '12px',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  },
  cardContent: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    flex: 1,
    padding: '24px',
    maxWidth: '600px',
  },
  cardTitle: {
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '20px',
    lineHeight: '28px',
    fontWeight: '700',
    color: '#171A1F',
    margin: '0 0 12px 0',
  },
  cardDescription: {
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '16px',
    lineHeight: '24px',
    fontWeight: '400',
    color: '#565E6C',
    margin: 0,
    textWrap: 'pretty',
  },
  cardLink: {
    marginTop: '24px',
  },
  linkText: {
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '14px',
    lineHeight: '22px',
    fontWeight: '400',
    color: '#2D66F5',
    textDecoration: 'none',
    display: 'inline-block',
    transition: 'color 0.2s',
  },
  figure: {
    margin: 0,
    padding: '0 24px 24px 24px',
  },
  mediaContainer: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gridTemplateRows: '1fr',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
  },
  mediaInner: {
    position: 'relative',
    zIndex: 1,
    gridColumn: '1 / -1',
    gridRow: '1 / -1',
    overflow: 'hidden',
  },
  picture: {
    display: 'block',
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  image: {
    objectFit: 'cover',
    width: '100%',
    height: '100%',
    display: 'block',
  },
}

// Add responsive styles
if (!document.getElementById('features-section-responsive-style')) {
  const responsiveStyle = document.createElement('style')
  responsiveStyle.id = 'features-section-responsive-style'
  responsiveStyle.textContent = `
    @media (min-width: 768px) {
      [data-features-grid] {
        grid-template-columns: repeat(2, 1fr) !important;
      }
    }
    @media (min-width: 1024px) {
      [data-features-grid] {
        grid-template-columns: repeat(3, 1fr) !important;
      }
    }
    @media (max-width: 767px) {
      [data-features-section] {
        padding: 24px 0 60px 0 !important;
      }
      [data-features-section] > div {
        padding: 0 16px !important;
      }
      [data-features-title] {
        font-size: 36px !important;
        line-height: 44px !important;
      }
    }
    [data-feature-card]:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    }
    [data-feature-card]:hover .link-text {
      color: #1353F4 !important;
    }
    .link-text {
      color: #2D66F5;
      transition: color 0.2s;
    }
    [data-features-section] .media-container {
      position: relative;
      width: 100%;
      aspect-ratio: 4/3;
    }
    @media (min-width: 768px) {
      [data-features-section] .media-container {
        aspect-ratio: 1/1;
      }
    }
  `
  document.head.appendChild(responsiveStyle)
}
