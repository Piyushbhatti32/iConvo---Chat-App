import { useState, useEffect } from 'react'
import ChatApp from './components/ChatApp'
import Login from './components/Login'
import { AuthState, User } from './types'
import './index.css'

function App() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    error: null
  })

  // Check for existing session on app load
  useEffect(() => {
    const session = localStorage.getItem('chatSession')
    if (session) {
      try {
        const { username } = JSON.parse(session)
        if (username) {
          const user: User = {
            id: Date.now().toString(),
            name: username,
            status: 'online'
          }
          setAuthState({
            isAuthenticated: true,
            user,
            isLoading: false,
            error: null
          })
        }
      } catch (error) {
        console.error('Error parsing session:', error)
        localStorage.removeItem('chatSession')
      }
    }
  }, [])

  const handleLogin = async (username: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Simulate authentication delay
      await new Promise(resolve => setTimeout(resolve, 1000))

      // For now, we'll accept any username (no actual authentication)
      // In a real app, you'd validate credentials here
      const user: User = {
        id: Date.now().toString(),
        name: username,
        status: 'online'
      }

      // Store session
      localStorage.setItem('chatSession', JSON.stringify({
        username: username,
        room: ''
      }))

      setAuthState({
        isAuthenticated: true,
        user,
        isLoading: false,
        error: null
      })
    } catch (error) {
      setAuthState({
        isAuthenticated: false,
        user: null,
        isLoading: false,
        error: 'Login failed. Please try again.'
      })
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('chatSession')
    setAuthState({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null
    })
  }

  return (
    <div className="h-screen overflow-hidden">
      {authState.isAuthenticated && authState.user ? (
        <ChatApp
          currentUser={authState.user}
          onLogout={handleLogout}
        />
      ) : (
        <Login
          onLogin={handleLogin}
          isLoading={authState.isLoading}
          error={authState.error || undefined}
        />
      )}
    </div>
  )
}

export default App