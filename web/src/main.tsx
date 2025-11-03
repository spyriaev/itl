import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './lib/i18n'
import { App } from './ui/App'

// Global error handler to suppress browser extension errors
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('Extension context invalidated')) {
    event.preventDefault()
    event.stopPropagation()
    return false
  }
})

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason
  if (reason && typeof reason === 'object' && 'message' in reason && 
      typeof reason.message === 'string' && 
      reason.message.includes('Extension context invalidated')) {
    event.preventDefault()
    return false
  }
})

const root = createRoot(document.getElementById('root')!)
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
