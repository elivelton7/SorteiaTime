export type PlayerPosition = 'goleiro' | 'linha'
export type AttendanceStatus = 'confirmado' | 'espera' | 'ausente'

export interface Profile {
    id: string
    email: string | null
    full_name: string | null
    avatar_url: string | null
    created_at: string
}

export interface Player {
    id: string
    user_id: string
    schedule_id: string   // players belong to a specific schedule
    name: string
    nickname: string | null
    position: PlayerPosition
    stars: number
    is_active: boolean
    created_at: string
}

export interface GameSchedule {
    id: string
    user_id: string
    title: string
    day_of_week: number   // 0=Dom … 6=Sáb
    start_time: string    // HH:MM
    end_time: string | null
    location: string | null
    notes: string | null
    players_per_team: number  // jogadores por time (ex: 5, 6, 7, 11)
    is_active: boolean
    created_at: string
}

export interface MatchAttendee {
    id: string
    schedule_id: string
    player_id: string
    game_date: string     // YYYY-MM-DD
    status: AttendanceStatus
    created_at: string
    player?: Player       // joined
}
