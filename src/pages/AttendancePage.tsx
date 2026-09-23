import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, RefreshCw, UserCheck, Clock, UserX } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Player, GameSchedule, MatchAttendee, AttendanceStatus } from '../types'
import StarRating from '../components/StarRating'

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const NEXT_STATUS: Record<AttendanceStatus, AttendanceStatus> = {
    confirmado: 'ausente',
    espera: 'confirmado',
    ausente: 'espera',
}

function StatusChip({ status, onClick }: { status: AttendanceStatus; onClick: () => void }) {
    const labels: Record<AttendanceStatus, string> = { confirmado: '✅ Confirmado', espera: '⏳ Espera', ausente: '❌ Ausente' }
    return (
        <button
            className={`status-chip chip-${status}`}
            onClick={onClick}
            title="Toque para alterar status"
        >
            {labels[status]}
        </button>
    )
}

function initials(name: string) {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

interface Props {
    scheduleId: string | null
    gameDate: string | null
    onBack: () => void
}

export default function AttendancePage({ scheduleId, gameDate, onBack }: Props) {
    const { user } = useAuth()
    const [schedule, setSchedule] = useState<GameSchedule | null>(null)
    const [players, setPlayers] = useState<Player[]>([])
    const [attendees, setAttendees] = useState<MatchAttendee[]>([])
    const [loading, setLoading] = useState(true)
    const [dateInput, setDateInput] = useState(gameDate ?? '')

    // ── Dados preparados para o algoritmo de sorteio ────────────
    // Retorna jogadores confirmados com posição e rating completos
    const getConfirmedPlayers = () =>
        players
            .filter(p => attendees.find(a => a.player_id === p.id)?.status === 'confirmado')
            .map(p => ({ id: p.id, name: p.name, nickname: p.nickname, position: p.position, stars: p.stars }))

    // Estatísticas do elenco confirmado para o balanceamento
    const getBalancingStats = () => {
        const confirmed = getConfirmedPlayers()
        return {
            total: confirmed.length,
            goalkeepers: confirmed.filter(p => p.position === 'goleiro'),
            outfield: confirmed.filter(p => p.position === 'linha'),
            avgRating: confirmed.length ? (confirmed.reduce((s, p) => s + p.stars, 0) / confirmed.length).toFixed(1) : '0',
            playersPerTeam: schedule?.players_per_team ?? 5,
        }
    }
    // ────────────────────────────────────────────────────────────

    const loadAll = useCallback(async () => {
        if (!scheduleId || !user || !dateInput) return
        setLoading(true)

        const [schedRes, playersRes, attendRes] = await Promise.all([
            supabase.from('game_schedules').select('*').eq('id', scheduleId).single(),
            supabase.from('players').select('*').eq('user_id', user.id).eq('is_active', true).order('name'),
            supabase.from('match_attendees').select('*').eq('schedule_id', scheduleId).eq('game_date', dateInput),
        ])

        setSchedule(schedRes.data)
        setPlayers(playersRes.data ?? [])
        setAttendees(attendRes.data ?? [])
        setLoading(false)
    }, [scheduleId, user, dateInput])

    useEffect(() => { loadAll() }, [loadAll])

    // Initialize all players as 'espera' if none exist yet
    const initAttendance = async () => {
        if (!scheduleId || !dateInput || players.length === 0) return
        const rows = players.map(p => ({
            schedule_id: scheduleId,
            player_id: p.id,
            game_date: dateInput,
            status: 'espera' as AttendanceStatus,
        }))
        await supabase.from('match_attendees').upsert(rows, { onConflict: 'schedule_id,player_id,game_date', ignoreDuplicates: true })
        loadAll()
    }

    const toggleStatus = async (playerId: string, current: AttendanceStatus | undefined) => {
        if (!scheduleId || !dateInput) return
        const next: AttendanceStatus = current ? NEXT_STATUS[current] : 'confirmado'

        await supabase.from('match_attendees').upsert({
            schedule_id: scheduleId,
            player_id: playerId,
            game_date: dateInput,
            status: next,
        }, { onConflict: 'schedule_id,player_id,game_date' })

        setAttendees(prev => {
            const exists = prev.find(a => a.player_id === playerId)
            if (exists) return prev.map(a => a.player_id === playerId ? { ...a, status: next } : a)
            return [...prev, { id: '', schedule_id: scheduleId, player_id: playerId, game_date: dateInput, status: next, created_at: '' }]
        })
    }

    const getStatus = (playerId: string): AttendanceStatus | undefined =>
        attendees.find(a => a.player_id === playerId)?.status

    // Count by status
    const countConfirmed = attendees.filter(a => a.status === 'confirmado').length
    const countEspera = attendees.filter(a => a.status === 'espera').length
    const countAusente = attendees.filter(a => a.status === 'ausente').length

    // Group players
    const confirmed = players.filter(p => getStatus(p.id) === 'confirmado')
    const espera = players.filter(p => getStatus(p.id) === 'espera')
    const ausente = players.filter(p => getStatus(p.id) === 'ausente')
    const unset = players.filter(p => !getStatus(p.id))

    const PlayerRow = ({ p }: { p: Player }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div className="avatar" style={{ background: p.position === 'goleiro' ? '#fef3c7' : '#dbeafe', color: p.position === 'goleiro' ? '#92400e' : '#1e40af', width: 38, height: 38, fontSize: 13 }}>
                {p.position === 'goleiro' ? '🧤' : initials(p.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}{p.nickname ? ` "${p.nickname}"` : ''}
                </div>
                <StarRating value={p.stars} readOnly size={12} />
            </div>
            <StatusChip status={getStatus(p.id) ?? 'espera'} onClick={() => toggleStatus(p.id, getStatus(p.id))} />
        </div>
    )

    if (!scheduleId) {
        return (
            <div className="empty-state" style={{ paddingTop: 80 }}>
                <div className="icon">⚽</div>
                <p style={{ fontWeight: 700, marginBottom: 8 }}>Nenhuma partida selecionada</p>
                <p>Vá em "Horários" e toque em um jogo para gerir as presenças.</p>
            </div>
        )
    }

    return (
        <div className="page-content">
            {/* Back header */}
            <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <button onClick={onBack} style={{ background: '#f3f4f6', border: 'none', borderRadius: 10, padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <ArrowLeft size={18} />
                </button>
                <div>
                    <h1 style={{ fontSize: 18, fontWeight: 900 }}>{schedule?.title ?? 'Partida'}</h1>
                    {schedule && <p style={{ fontSize: 13, color: '#6b7280' }}>{DAYS[schedule.day_of_week]} · {schedule.start_time.slice(0, 5)}</p>}
                </div>
            </div>

            {/* Date selector */}
            <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>DATA DO JOGO</label>
                    <input className="form-input" type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} style={{ padding: '10px 12px' }} />
                </div>
                <button
                    onClick={initAttendance}
                    className="btn btn-ghost"
                    style={{ marginTop: 20, padding: '10px 14px', fontSize: 13 }}
                    title="Importar todos os jogadores com status 'em espera'"
                >
                    <RefreshCw size={16} /> Importar
                </button>
            </div>

            {/* Summary bar */}
            <div style={{ margin: '0 16px 12px', background: '#f9fafb', borderRadius: 14, padding: '12px 16px' }}>
                {/* Format badge */}
                {schedule?.players_per_team && (
                    <div style={{ textAlign: 'center', marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#16a34a', background: '#dcfce7', padding: '4px 14px', borderRadius: 100 }}>
                            ⚽ {schedule.players_per_team} vs {schedule.players_per_team}
                        </span>
                    </div>
                )}
                {/* Counts grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#16a34a' }}>{countConfirmed}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>CONFIRMADOS</div>
                    </div>
                    <div style={{ textAlign: 'center', borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#d97706' }}>{countEspera + unset.length}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>EM ESPERA</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#dc2626' }}>{countAusente}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>AUSENTES</div>
                    </div>
                </div>
                {/* Balancing stats — only when there are confirmed players */}
                {countConfirmed > 0 && (() => {
                    const stats = getBalancingStats()
                    return (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>
                                🧤 <strong>{stats.goalkeepers.length}</strong> goleiro{stats.goalkeepers.length !== 1 ? 's' : ''}
                            </span>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>
                                ⚽ <strong>{stats.outfield.length}</strong> linha
                            </span>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>
                                ★ média <strong>{stats.avgRating}</strong>
                            </span>
                        </div>
                    )
                })()}
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 32 }}>
                    <span className="spinner" />
                </div>
            ) : players.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">👥</div>
                    <p style={{ fontWeight: 700 }}>Sem jogadores cadastrados</p>
                    <p>Cadastre jogadores na aba "Jogadores" primeiro.</p>
                </div>
            ) : (
                <div style={{ padding: '0 16px' }}>
                    {/* Confirmed */}
                    {confirmed.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <UserCheck size={15} color="#16a34a" />
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>CONFIRMADOS ({confirmed.length})</span>
                            </div>
                            {confirmed.map(p => <PlayerRow key={p.id} p={p} />)}
                        </div>
                    )}

                    {/* Espera / não definido */}
                    {(espera.length + unset.length) > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <Clock size={15} color="#d97706" />
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#d97706' }}>EM ESPERA ({espera.length + unset.length})</span>
                            </div>
                            {[...espera, ...unset].map(p => <PlayerRow key={p.id} p={p} />)}
                        </div>
                    )}

                    {/* Ausentes */}
                    {ausente.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                <UserX size={15} color="#dc2626" />
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>AUSENTES ({ausente.length})</span>
                            </div>
                            {ausente.map(p => <PlayerRow key={p.id} p={p} />)}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
