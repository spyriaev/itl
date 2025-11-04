import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Document, Page, pdfjs } from 'react-pdf'
import { PageRelatedQuestions } from './PageRelatedQuestions'
import { ZoomControl } from './ZoomControl'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import '../styles/buttons.css'
import '../styles/typography.css'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface HeroSectionProps {
  onStartClick: () => void
}

export function HeroSection({ onStartClick }: HeroSectionProps) {
  const { t } = useTranslation()
  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [scale, setScale] = useState<number>(0.75)
  const pdfUrl = '/1706.03762v7.pdf'
  const pdfPageRef = useRef<HTMLDivElement>(null)
  const questionsRef = useRef<HTMLDivElement>(null)

  // Zoom functions
  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.1, 2.0))
  }

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.1, 0.5))
  }

  const fitToWidth = () => {
    // For demo, set a reasonable scale that fits width
    if (pdfPageRef.current) {
      const containerWidth = pdfPageRef.current.offsetWidth - 48 // padding
      const pdfPageWidth = 816 // standard PDF page width at 72 DPI
      const calculatedScale = (containerWidth / pdfPageWidth) * 0.95
      setScale(Math.max(0.5, Math.min(calculatedScale, 2.0)))
    }
  }

  const fitToTextWidth = () => {
    // For demo, slightly smaller than fit to width
    if (pdfPageRef.current) {
      const containerWidth = pdfPageRef.current.offsetWidth - 48
      const pdfPageWidth = 816
      const calculatedScale = (containerWidth / pdfPageWidth) * 0.85
      setScale(Math.max(0.5, Math.min(calculatedScale, 2.0)))
    }
  }

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    // Scroll to show questions after PDF loads
    setTimeout(() => {
      if (questionsRef.current && pdfPageRef.current) {
        questionsRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }
    }, 500)
  }

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error)
    setPageError('Failed to load PDF')
  }

  return (
    <section style={styles.section} data-hero-section>
      <div style={styles.container}>
        <div style={styles.textBlock}>
          <h1 style={styles.heading} data-hero-title>{t("landing.heroTitle")}</h1>
          <div style={styles.buttonsContainer}>
            <div style={styles.buttonsWrapper}>
              <button className="button-primary" onClick={onStartClick} style={styles.primaryButton} data-hero-button>
                {t("landing.startOnWeb")}
                <span style={styles.buttonIcon} aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </div>
        
        <div className="media-container" style={styles.mediaContainer}>
          <div className="demo-container" style={styles.demoContainer}>
                          <div className="demo-content" style={styles.demoContent}>
              <div style={styles.srOnly} aria-live="polite">
                This element contains an interactive demo showing PDF viewer interface with chat panel.
              </div>
                              <div className="demo-visual" style={styles.demoVisual}>
                <div className="window-container" style={styles.windowContainer}>
                  {/* Window Header */}
                  <div className="window-header" style={styles.windowHeader}>
                    <div style={styles.windowControls}>
                      <span style={styles.controlDot}></span>
                      <span style={styles.controlDot}></span>
                      <span style={styles.controlDot}></span>
                    </div>
                    <div style={styles.windowTitle}>Document Viewer</div>
                    <div style={styles.windowActions}></div>
                  </div>
                  
                  {/* Main Content */}
                  <div className="window-content" style={styles.windowContent}>
                    {/* PDF Viewer Area */}
                    <div className="viewer-area" style={styles.viewerArea}>
                      {/* Zoom Control */}
                      <div style={styles.zoomControlWrapper}>
                        <div style={styles.zoomControlInner}>
                          <ZoomControl
                            scale={scale}
                            onZoomIn={zoomIn}
                            onZoomOut={zoomOut}
                            onFitToWidth={fitToWidth}
                            onFitToTextWidth={fitToTextWidth}
                            isTablet={false}
                            isChatVisible={false}
                            isMobile={false}
                          />
                        </div>
                      </div>
                      <div style={styles.pdfPage} ref={pdfPageRef}>
                        <div style={styles.pdfContent}>
                          {pageError ? (
                            <div style={styles.pdfError}>
                              {pageError}
                            </div>
                          ) : (
                            <Document
                              file={pdfUrl}
                              onLoadSuccess={onDocumentLoadSuccess}
                              onLoadError={onDocumentLoadError}
                              loading={
                                <div style={styles.pdfLoading}>
                                  Loading PDF...
                                </div>
                              }
                              options={{
                                disableFontFace: false,
                                enableXfa: false,
                                maxImageSize: 5242880,
                                standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
                              }}
                            >
                              <div style={styles.pdfPageWrapper}>
                                <div style={styles.pdfPageInner}>
                                  <Page
                                    pageNumber={3}
                                    scale={scale}
                                    renderTextLayer={true}
                                    renderAnnotationLayer={false}
                                  />
                                </div>
                                {/* Show bottom edge of page */}
                                <div style={styles.pageBottomEdge}></div>
                              </div>
                            </Document>
                          )}
                          {/* PageRelatedQuestions - at the bottom of the page */}
                          <div ref={questionsRef} className="questions-wrapper" style={styles.questionsWrapper}>
                            <PageRelatedQuestions
                            questionsData={{
                              pageNumber: 1,
                              totalQuestions: 2,
                              questions: [
                                {
                                  id: 'demo-1',
                                  threadId: 'demo-thread-1',
                                  threadTitle: 'What is attention mechanism?',
                                  content: 'What is attention mechanism?',
                                  answer: 'The attention mechanism allows the model to focus on different parts of the input sequence when processing each position.',
                                  createdAt: new Date().toISOString(),
                                  userId: 'demo-user',
                                  isOwn: true,
                                  canOpenThread: true,
                                },
                                {
                                  id: 'demo-2',
                                  threadId: 'demo-thread-2',
                                  threadTitle: 'How does transformer work?',
                                  content: 'How does transformer work?',
                                  answer: 'Transformers use self-attention mechanisms to process sequences in parallel, unlike RNNs which process sequentially.',
                                  createdAt: new Date().toISOString(),
                                  userId: 'demo-user',
                                  isOwn: true,
                                  canOpenThread: true,
                                },
                              ],
                            }}
                            onQuestionClick={(threadId, messageId) => {
                              // Demo: no-op
                            }}
                            isStreaming={false}
                            currentPageNumber={1}
                          />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Chat Panel */}
                    <div className="chat-panel" style={styles.chatPanel}>
                      {/* Header */}
                      <div style={styles.chatHeader}>
                        <h3 style={styles.chatTitle}>
                          Assistant
                        </h3>
                      </div>

                      {/* Messages area */}
                      <div style={styles.chatMessages}>
                        <div style={styles.chatMessage}>
                          <div style={styles.userMessage}>
                            Explain the key findings in this document
                          </div>
                        </div>
                        <div style={styles.chatMessage}>
                          <div style={styles.assistantMessage}>
                            Based on the document, the key findings include:
                            <br /><br />
                            • Significant improvements in comprehension accuracy with contextual AI
                            <br />
                            • Enhanced document analysis through visual and textual understanding
                            <br />
                            • Revolutionized interaction with digital content
                          </div>
                        </div>
                      </div>

                      {/* Input area */}
                      <div style={styles.chatInputArea}>
                        {/* Context selector */}
                        <div style={styles.repoSection}>
                          <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                width="24" 
                                height="24" 
                                viewBox="-4 -4 40 40" 
                                style={styles.contextIcon}
                              >
                                <circle 
                                  fill="none" 
                                  stroke="#686583" 
                                  strokeWidth="2.4" 
                                  strokeLinecap="square" 
                                  strokeMiterlimit="10" 
                                  cx="5" 
                                  cy="5" 
                                  r="4" 
                                  strokeLinejoin="miter"
                                />
                                <line 
                                  fill="none" 
                                  stroke="#686583" 
                                  strokeWidth="2.4" 
                                  strokeLinecap="square" 
                                  strokeMiterlimit="10" 
                                  x1="15" 
                                  y1="5" 
                                  x2="31" 
                                  y2="5" 
                                  strokeLinejoin="miter"
                                />
                                <line 
                                  fill="none" 
                                  stroke="#686583" 
                                  strokeWidth="2.4" 
                                  strokeLinecap="square" 
                                  strokeMiterlimit="10" 
                                  x1="15" 
                                  y1="13" 
                                  x2="31" 
                                  y2="13" 
                                  strokeLinejoin="miter"
                                />
                                <circle 
                                  fill="none" 
                                  stroke="#686583" 
                                  strokeWidth="2.4" 
                                  strokeLinecap="square" 
                                  strokeMiterlimit="10" 
                                  cx="5" 
                                  cy="21" 
                                  r="4" 
                                  strokeLinejoin="miter"
                                />
                                <line 
                                  fill="none" 
                                  stroke="#686583" 
                                  strokeWidth="2.4" 
                                  strokeLinecap="square" 
                                  strokeMiterlimit="10" 
                                  x1="15" 
                                  y1="21" 
                                  x2="31" 
                                  y2="21" 
                                  strokeLinejoin="miter"
                                />
                                <line 
                                  fill="none" 
                                  stroke="#686583" 
                                  strokeWidth="2.4" 
                                  strokeLinecap="square" 
                                  strokeMiterlimit="10" 
                                  x1="15" 
                                  y1="29" 
                                  x2="31" 
                                  y2="29" 
                                  strokeLinejoin="miter"
                                />
                              </svg>
                              <select
                                value="chapter"
                                disabled={true}
                                style={styles.contextSelect}
                              >
                                <option value="none">No context</option>
                                <option value="page">Current Page</option>
                                <option value="chapter">Current Chapter</option>
                              </select>
                            </div>
                            <div style={styles.contextDisplay}>
                              <span style={{ fontWeight: 500, color: '#111827' }}>
                                Attention Is All You Need
                              </span>
                              <span style={{ fontSize: '10px', color: '#6B7280' }}>
                                Pages 1-15
                              </span>
                            </div>
                          </div>
                        </div>
                        <div style={styles.inputContainer}>
                          <form style={styles.inputForm}>
                            <div style={{ position: 'relative' }}>
                              <div
                                style={styles.editor}
                                contentEditable={false}
                                role="textbox"
                                suppressContentEditableWarning
                              >
                              </div>
                              <div style={styles.inputPlaceholder}>
                                Ask about this document...
                              </div>
                            </div>
                            <div style={styles.controls}>
                              <div style={styles.leftControls}></div>
                              <div style={styles.rightControls}>
                                <button
                                  type="button"
                                  style={styles.submitButton}
                                >
                                  <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    width="16" 
                                    height="16" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                  >
                                    <path d="m5 12 7-7 7 7"></path>
                                    <path d="M12 19V5"></path>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
    backgroundColor: 'white',
    color: '#171A1F',
    padding: '32px 0 40px 0',
    width: '100%',
  },
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '0 32px',
  },
  textBlock: {
    textAlign: 'left',
    marginBottom: '40px',
    maxWidth: '600px',
  },
  heading: {
    fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
    fontSize: '48px',
    lineHeight: '56px',
    fontWeight: '700',
    color: '#171A1F',
    margin: '0 0 24px 0',
    textWrap: 'balance',
  },
  buttonsContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: '16px',
  },
  buttonsWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 20px',
    height: '44px',
    fontSize: '16px',
    fontWeight: '500',
  },
  buttonIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '16px',
  },
  mediaContainer: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    marginTop: '48px',
    height: 'min(780px, 70vh)',
    minHeight: '680px',
    padding: '20px',
  },
  demoContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  demoContent: {
    position: 'relative',
    width: '100%',
    maxWidth: '1024px',
    height: '100%',
    maxHeight: '560px',
    overflow: 'visible',
    userSelect: 'none',
  },
  demoVisual: {
    pointerEvents: 'none',
    position: 'absolute',
    inset: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: 0,
  },
  windowContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1e1e1e',
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: '0 28px 70px rgba(0, 0, 0, 0.14), 0 14px 32px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column',
  },
  windowHeader: {
    height: '28px',
    backgroundColor: '#2d2d2d',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 8px',
    flexShrink: 0,
  },
  windowControls: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  },
  controlDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    display: 'inline-block',
  },
  windowTitle: {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  windowActions: {
    width: '80px',
  },
  windowContent: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  viewerArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    position: 'relative',
  },
  zoomControlWrapper: {
    position: 'absolute',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1000,
  },
  zoomControlInner: {
    // Custom zoom control container for demo
  },

  pdfPage: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '24px',
    overflowY: 'auto',
    overflowX: 'hidden',
    backgroundColor: '#f3f4f6',
  },
  pdfContent: {
    width: '100%',
    maxWidth: '816px',
    backgroundColor: '#ffffff',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    padding: '24px',
    paddingBottom: '0',
    borderRadius: '4px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    overflow: 'visible',
  },
  pdfPageWrapper: {
    position: 'relative',
    width: '100%',
    maxHeight: '400px',
    overflow: 'hidden',
    marginBottom: '0',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  pdfPageInner: {
    maxWidth: '100%',
    height: 'auto',
    overflow: 'hidden',
    clipPath: 'inset(0 0 0 0)',
  },
  pageBottomEdge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '8px',
    background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.08) 50%, transparent 100%)',
    pointerEvents: 'none',
    zIndex: 10,
  },
  pdfLoading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '600px',
    color: '#6b7280',
    fontSize: '14px',
  },
  pdfError: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '600px',
    color: '#dc2626',
    fontSize: '14px',
  },
  questionsWrapper: {
    width: '100%',
    maxWidth: '816px',
    marginTop: '0',
    padding: '24px 24px 24px 24px',
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
  },
  chatPanel: {
    width: '400px',
    backgroundColor: '#ffffff',
    borderLeft: '1px solid #E5E7EB',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  chatHeader: {
    padding: '16px',
    borderBottom: '1px solid #E5E7EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    flexShrink: 0,
  },
  chatTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#111827',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  chatMessages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 0',
    backgroundColor: '#FAFAFA',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  chatMessage: {
    display: 'flex',
    flexDirection: 'column',
    padding: '0 16px',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#3B82F6',
    color: '#ffffff',
    padding: '12px 16px',
    borderRadius: '18px',
    maxWidth: '80%',
    fontSize: '14px',
    lineHeight: '1.5',
    wordWrap: 'break-word',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    color: '#111827',
    padding: '12px 16px',
    borderRadius: '18px',
    maxWidth: '80%',
    fontSize: '14px',
    lineHeight: '1.5',
    wordWrap: 'break-word',
  },
  chatInputArea: {
    padding: '16px',
    borderTop: '1px solid #E5E7EB',
    backgroundColor: '#ffffff',
    flexShrink: 0,
  },
  repoSection: {
    marginBottom: '8px',
    padding: '0 12px',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '16px',
    minHeight: '32px',
  },
  contextIcon: {
    width: '14px',
    height: '14px',
    color: '#6b7280',
    transition: 'color 0.15s ease',
    flexShrink: 0,
  },
  contextSelect: {
    flex: 1,
    padding: '6px 8px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '12px',
    backgroundColor: 'transparent',
    color: '#6b7280',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    outline: 'none',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
    backgroundPosition: 'right 0.5rem center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '1.5em 1.5em',
    paddingRight: '2.5rem',
  },
  contextDisplay: {
    fontSize: '11px',
    color: '#6b7280',
    paddingLeft: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  inputContainer: {
    display: 'flex',
    width: '100%',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    border: '1px solid #e5e7eb',
    overflow: 'hidden',
    borderRadius: '12px',
    cursor: 'text',
  },
  inputForm: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  editor: {
    color: '#374151',
    maxHeight: '400px',
    minHeight: '64px',
    width: '100%',
    resize: 'none',
    backgroundColor: 'transparent',
    padding: '12px',
    fontSize: '14px',
    outline: 'none',
    overflowY: 'auto',
    userSelect: 'text',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  inputPlaceholder: {
    pointerEvents: 'none',
    position: 'absolute',
    left: '12px',
    top: '12px',
    fontSize: '14px',
    opacity: 1,
    color: '#6b7280',
    transition: 'opacity 0.2s ease',
    userSelect: 'none',
  },
  controls: {
    paddingBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 8px 0 12px',
  },
  leftControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    minHeight: '28px',
  },
  rightControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '-15px',
  },
  submitButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: '9999px',
    border: '1px solid #e5e7eb',
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    cursor: 'not-allowed',
    outline: 'none',
    transition: 'all 0.2s ease',
  },
}

// Add responsive styles
if (!document.getElementById('hero-section-responsive-style')) {
  const responsiveStyle = document.createElement('style')
  responsiveStyle.id = 'hero-section-responsive-style'
  responsiveStyle.textContent = `
    @media (max-width: 768px) {
      [data-hero-section] {
        padding: 24px 0 24px 0 !important;
      }
      [data-hero-section] > div {
        padding: 0 16px !important;
      }
      [data-hero-title] {
        font-size: 36px !important;
        line-height: 44px !important;
      }
      [data-hero-button] {
        width: 100% !important;
      }
      [data-hero-section] .viewer-area {
        display: none !important;
      }
      [data-hero-section] .window-header {
        display: none !important;
      }
      [data-hero-section] .window-content {
        flex-direction: column !important;
      }
      [data-hero-section] .chat-panel {
        width: 100% !important;
        max-width: 100% !important;
        border-left: none !important;
        border-top: 1px solid #e5e7eb !important;
      }
    }
    @media (min-width: 769px) and (max-width: 1024px) {
      [data-hero-section] .window-container {
        transform: none !important;
      }
      [data-hero-section] .demo-content {
        transform: none !important;
      }
      [data-hero-section] .demo-visual {
        transform: none !important;
      }
      [data-hero-section] .media-container,
      [data-hero-section] .demo-container {
        transform: none !important;
      }
      [data-hero-section] .viewer-area {
        display: block !important;
        flex: 1 !important;
      }
      [data-hero-section] .chat-panel {
        display: none !important;
      }
    }
    @media (min-width: 901px) {
      [data-hero-section] .media-container {
        min-height: 680px;
      }
    }
    [data-hero-section] select {
      opacity: 1 !important;
    }
    [data-hero-section] select:not(:disabled):hover {
      color: #374151 !important;
    }
    [data-hero-section] select:disabled {
      opacity: 0.6 !important;
      cursor: not-allowed !important;
    }
    [data-hero-section] select:focus {
      outline: none;
    }
    [data-hero-section] .questions-wrapper > div {
      width: 100% !important;
      max-width: 100% !important;
      margin-top: 0 !important;
    }
    [data-hero-section] .questions-wrapper > div > div {
      width: 100% !important;
    }
  `
  document.head.appendChild(responsiveStyle)
}
