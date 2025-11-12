import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Register service worker for push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope)
        
        // Check for updates when page becomes visible (user returns to tab)
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            registration.update()
          }
        })
        
        // Also check on page load
        registration.update()
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error)
      })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

