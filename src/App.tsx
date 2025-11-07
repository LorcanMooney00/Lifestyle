import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import LoginPage from './pages/LoginPage'
import PartnerDashboardPage from './pages/PartnerDashboardPage'
import TopicsPage from './pages/TopicsPage'
import NotesPage from './pages/NotesPage'
import CalendarPage from './pages/CalendarPage'
import SettingsPage from './pages/SettingsPage'

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/app/partner/:partnerId"
          element={
            <AuthGate>
              <PartnerDashboardPage />
            </AuthGate>
          }
        />
        <Route
          path="/app/partner/:partnerId/notes"
          element={
            <AuthGate>
              <NotesPage />
            </AuthGate>
          }
        />
        <Route
          path="/app/partner/:partnerId/calendar"
          element={
            <AuthGate>
              <CalendarPage />
            </AuthGate>
          }
        />
        <Route
          path="/app/topics"
          element={
            <AuthGate>
              <TopicsPage />
            </AuthGate>
          }
        />
        <Route
          path="/app/notes"
          element={
            <AuthGate>
              <NotesPage />
            </AuthGate>
          }
        />
        <Route
          path="/app/calendar"
          element={
            <AuthGate>
              <CalendarPage />
            </AuthGate>
          }
        />
        <Route
          path="/app/settings"
          element={
            <AuthGate>
              <SettingsPage />
            </AuthGate>
          }
        />
        <Route path="/" element={<Navigate to="/app/topics" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

