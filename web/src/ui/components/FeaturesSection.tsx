import React from 'react'
import { useTranslation } from 'react-i18next'
import '../styles/buttons.css'
import '../styles/typography.css'

export function FeaturesSection() {
  const { t } = useTranslation()

  return (
    <section style={styles.section} data-features-section>
      <h2 className="text-heading-medium" data-features-title>{t("landing.featuresTitle")}</h2>
      <div style={styles.grid} data-features-grid>
        <div style={{...styles.feature, ...styles.feature1}} data-feature-card>
          <h3 className="text-heading-small" data-feature-title>{t("landing.feature1Title")}</h3>
          <p className="text-body" data-feature-desc>{t("landing.feature1Desc")}</p>
          <div style={styles.featureIllustration1}>
            <div style={styles.fileList}>
              <div style={styles.fileItem}>
                <div style={styles.fileIcon}></div>
                <div style={styles.fileInfo}>
                  <div style={styles.fileName}>Work Documents.zip</div>
                  <div style={styles.fileSize}>2.4 MB</div>
                </div>
                <div style={styles.starIcon}>★</div>
              </div>
              <div style={styles.fileItem}>
                <div style={styles.fileIcon}></div>
                <div style={styles.fileInfo}>
                  <div style={styles.fileName}>Freelancing</div>
                  <div style={styles.fileSize}>1.2 MB</div>
                </div>
                <div style={styles.starIcon}>★</div>
              </div>
              <div style={styles.fileItem}>
                <div style={styles.fileIcon}></div>
                <div style={styles.fileInfo}>
                  <div style={styles.fileName}>Quotation/Invoice.xlsx</div>
                  <div style={styles.fileSize}>856 KB</div>
                </div>
                <div style={styles.starIcon}>★</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{...styles.feature, ...styles.feature2}} data-feature-card>
          <h3 className="text-heading-small" data-feature-title>{t("landing.feature2Title")}</h3>
          <p className="text-body" data-feature-desc>{t("landing.feature2Desc")}</p>
          <a href="#" className="button-text">{t("landing.feature2Cta")}</a>
          <div style={styles.featureIllustration2}>
            <div style={styles.shareModal}>
              <div style={styles.shareModalTitle}>Share this file to</div>
              <div style={styles.shareInput}>
                <span>@Users or teams</span>
                <button className="button-primary" style={{ fontSize: '12px', padding: '6px 12px', height: 'auto' }}>Add emails</button>
              </div>
              <div style={styles.peopleList}>
                <div style={styles.personItem}>
                  <div style={styles.avatar}>JD</div>
                  <div>
                    <div style={styles.personName}>Joshua Davis</div>
                    <div style={styles.personEmail}>joshua@example.com</div>
                  </div>
                </div>
                <div style={styles.personItem}>
                  <div style={styles.avatar}>SG</div>
                  <div>
                    <div style={styles.personName}>Sarah Green</div>
                    <div style={styles.personEmail}>sarah@example.com</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{...styles.feature, ...styles.feature3}} data-feature-card>
          <h3 className="text-heading-small" data-feature-title>{t("landing.feature3Title")}</h3>
          <p className="text-body" data-feature-desc>{t("landing.feature3Desc")}</p>
          <a href="#" className="button-text">{t("landing.feature3Cta")}</a>
          <div style={styles.featureIllustration3}>
            <div style={styles.documentView}>
              <div style={styles.docToolbar}>
                <button style={styles.toolbarBtn}>Download</button>
                <button style={styles.toolbarBtn}>Open in</button>
                <button style={styles.toolbarBtn}>Save as</button>
                <button className="button-primary" style={{ fontSize: '12px', padding: '6px 12px', height: 'auto', marginLeft: 'auto' }}>Share</button>
              </div>
              <div style={styles.docContent}>
                <div style={styles.docText}>Contract Document Content...</div>
              </div>
              <div style={styles.commentsSidebar}>
                <div style={styles.commentsHeader}>Comments (12) Activities</div>
              </div>
              <div style={styles.addCommentBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Add a comment
              </div>
            </div>
          </div>
        </div>

        <div style={{...styles.feature, ...styles.feature4}} data-feature-card>
          <h3 className="text-heading-small" data-feature-title>{t("landing.feature4Title")}</h3>
          <p className="text-body" data-feature-desc>{t("landing.feature4Desc")}</p>
          <div style={styles.featureIllustration4}>
            <div style={styles.docStack}>
              <div style={styles.doc3}></div>
              <div style={styles.doc2}></div>
              <div style={styles.doc1}>
                <div style={styles.docIcon}>📄</div>
                <div style={styles.docTitle}>Training doc.docx</div>
                <div style={styles.docSaved}>Changes saved.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  section: {
    padding: '80px 32px',
    maxWidth: '1280px',
    margin: '0 auto',
    backgroundColor: '#f9fafb',
  },
  title: {
    marginBottom: '48px',
    textAlign: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
  },
  feature: {
    borderRadius: '16px',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  feature1: {
    backgroundColor: 'white',
  },
  feature2: {
    backgroundColor: '#FEF9C3',
  },
  feature3: {
    backgroundColor: '#FCE7F3',
  },
  feature4: {
    backgroundColor: '#D1FAE5',
  },
  featureIllustration1: {
    marginTop: '16px',
  },
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
  },
  fileIcon: {
    width: '32px',
    height: '32px',
    backgroundColor: '#2d66f5',
    borderRadius: '4px',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: '14px',
    lineHeight: '22px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontWeight: '400',
    color: '#171A1F',
  },
  fileSize: {
    fontSize: '14px',
    lineHeight: '22px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontWeight: '400',
    color: '#323842',
  },
  starIcon: {
    color: '#fbbf24',
    fontSize: '16px',
  },
  featureIllustration2: {
    marginTop: '16px',
  },
  shareModal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  },
  shareModalTitle: {
    fontSize: '14px',
    lineHeight: '22px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontWeight: '700',
    color: '#171A1F',
    marginBottom: '12px',
  },
  shareInput: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '4px',
    marginBottom: '16px',
    fontSize: '14px',
    lineHeight: '22px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontWeight: '400',
    color: '#565E6C',
  },
  peopleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  personItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#2d66f5',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '600',
  },
  personName: {
    fontSize: '14px',
    lineHeight: '22px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontWeight: '400',
    color: '#171A1F',
  },
  personEmail: {
    fontSize: '14px',
    lineHeight: '22px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontWeight: '400',
    color: '#323842',
  },
  featureIllustration3: {
    marginTop: '16px',
  },
  documentView: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    position: 'relative',
    minHeight: '200px',
  },
  docToolbar: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
    borderBottom: '1px solid #e5e7eb',
    paddingBottom: '12px',
  },
  toolbarBtn: {
    padding: '6px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    backgroundColor: 'white',
    fontSize: '12px',
    cursor: 'pointer',
  },
  docContent: {
    padding: '12px',
    minHeight: '100px',
  },
  docText: {
    fontSize: '12px',
    color: '#374151',
    lineHeight: '1.6',
  },
  commentsSidebar: {
    position: 'absolute',
    right: '16px',
    top: '60px',
    width: '120px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    padding: '12px',
  },
  commentsHeader: {
    fontSize: '14px',
    lineHeight: '22px',
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontWeight: '700',
    color: '#171A1F',
  },
  addCommentBtn: {
    position: 'absolute',
    bottom: '16px',
    right: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    fontSize: '12px',
    color: '#374151',
    cursor: 'pointer',
  },
  featureIllustration4: {
    marginTop: '16px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '200px',
  },
  docStack: {
    position: 'relative',
    width: '120px',
    height: '160px',
  },
  doc3: {
    position: 'absolute',
    top: '8px',
    left: '8px',
    width: '100px',
    height: '140px',
    backgroundColor: '#e5e7eb',
    borderRadius: '4px',
    transform: 'rotate(-2deg)',
  },
  doc2: {
    position: 'absolute',
    top: '4px',
    left: '4px',
    width: '100px',
    height: '140px',
    backgroundColor: '#d1d5db',
    borderRadius: '4px',
    transform: 'rotate(-1deg)',
  },
  doc1: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100px',
    height: '140px',
    backgroundColor: '#2d66f5',
    borderRadius: '4px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
  docIcon: {
    fontSize: '32px',
  },
  docTitle: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
  docSaved: {
    fontSize: '10px',
    color: 'rgba(255, 255, 255, 0.8)',
  },
}

