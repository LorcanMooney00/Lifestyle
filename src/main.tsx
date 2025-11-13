import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// OneSignal handles its own service worker registration
// No need to register sw.js - OneSignal will use OneSignalSDKWorker.js

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

