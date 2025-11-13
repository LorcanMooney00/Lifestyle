import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { PhotoProvider } from './contexts/PhotoContext'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import PartnerDashboardPage from './pages/PartnerDashboardPage'
import TopicsPage from './pages/TopicsPage'
import NotesPage from './pages/NotesPage'
import CalendarPage from './pages/CalendarPage'
import RecipesPage from './pages/RecipesPage'
import TodosPage from './pages/TodosPage'
import SettingsPage from './pages/SettingsPage'
import ShoppingListPage from './pages/ShoppingListPage'
import GroupPage from './pages/GroupPage'

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
  // Ensure body scroll is always enabled on app load
  useEffect(() => {
    // Force reset all body styles that might block scrolling
    document.body.style.overflow = 'visible'
    document.body.style.position = 'static'
    document.body.style.touchAction = 'auto'
    document.body.style.height = 'auto'
    
    // Also reset html
    document.documentElement.style.overflow = 'auto'
    
    console.log('Body styles reset on app load')
  }, [])

  return (
    <PhotoProvider>
      <BrowserRouter>
        <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
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
          path="/app/group/:groupId"
          element={
            <AuthGate>
              <GroupPage />
            </AuthGate>
          }
        />
        <Route
          path="/app/recipes"
          element={
            <AuthGate>
              <RecipesPage />
            </AuthGate>
          }
        />
        <Route
          path="/app/partner/:partnerId/recipes"
          element={
            <AuthGate>
              <RecipesPage />
            </AuthGate>
          }
        />
        <Route
          path="/app/partner/:partnerId/todos"
          element={
            <AuthGate>
              <TodosPage />
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
        <Route
          path="/app/todos"
          element={
            <AuthGate>
              <TodosPage />
            </AuthGate>
          }
        />
        <Route
          path="/app/shopping"
          element={
            <AuthGate>
              <ShoppingListPage />
            </AuthGate>
          }
        />
        <Route
          path="/app/partner/:partnerId/shopping"
          element={
            <AuthGate>
              <ShoppingListPage />
            </AuthGate>
          }
        />
        <Route path="/" element={<Navigate to="/app/topics" replace />} />
        </Routes>
      </BrowserRouter>
    </PhotoProvider>
  )
}

export default App

