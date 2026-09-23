import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import SchedulesPage from './pages/SchedulesPage'
import ScheduleDetailPage from './pages/ScheduleDetailPage'
import type { GameSchedule } from './types'
import './index.css'

function AppShell() {
    const { user, loading } = useAuth()
    const [selectedSchedule, setSelectedSchedule] = useState<GameSchedule | null>(null)

    if (loading) {
        return (
            <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, background: 'white' }}>
                <span style={{ fontSize: 52 }}>⚽</span>
                <span className="spinner" />
            </div>
        )
    }

    if (!user) return <LoginPage />

    // Drill-in: show schedule detail
    if (selectedSchedule) {
        return (
            <ScheduleDetailPage
                schedule={selectedSchedule}
                onBack={() => setSelectedSchedule(null)}
            />
        )
    }

    // Home: list of schedules
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'white', maxWidth: 480, margin: '0 auto' }}>
            <SchedulesPage onSelect={setSelectedSchedule} />
        </div>
    )
}

export default function App() {
    return (
        <AuthProvider>
            <AppShell />
        </AuthProvider>
    )
}
