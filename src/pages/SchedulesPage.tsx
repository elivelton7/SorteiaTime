import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Clock, MapPin, Users, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { GameSchedule } from '../types'
import Modal from '../components/Modal'

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const PLAYERS_PRESETS = [4, 5, 6, 7, 8, 9, 10, 11]

const EMPTY_FORM = { title: '', day_of_week: 6, start_time: '08:00', end_time: '', location: '', notes: '', players_per_team: 5 }

interface Props {
    onSelect: (schedule: GameSchedule) => void
}

export default function SchedulesPage({ onSelect }: Props) {
    const { user, signOut } = useAuth()
    const [schedules, setSchedules] = useState<GameSchedule[]>([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<GameSchedule | null>(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    const load = async () => {
        if (!user) return
        const { data } = await supabase.from('game_schedules').select('*').eq('user_id', user.id).eq('is_active', true).order('day_of_week')
        setSchedules(data ?? [])
        setLoading(false)
    }

    useEffect(() => { load() }, [user])

    const openAdd = () => { setEditTarget(null); setForm(EMPTY_FORM); setModalOpen(true) }
    const openEdit = (s: GameSchedule, e: React.MouseEvent) => {
        e.stopPropagation()
        setEditTarget(s)
        setForm({ title: s.title, day_of_week: s.day_of_week, start_time: s.start_time.slice(0, 5), end_time: s.end_time?.slice(0, 5) ?? '', location: s.location ?? '', notes: s.notes ?? '', players_per_team: s.players_per_team ?? 5 })
        setModalOpen(true)
    }

    const save = async () => {
        if (!form.title.trim() || !user) return
        setSaving(true)
        const payload = { title: form.title.trim(), day_of_week: form.day_of_week, start_time: form.start_time, end_time: form.end_time || null, location: form.location.trim() || null, notes: form.notes.trim() || null, players_per_team: form.players_per_team }
        if (editTarget) {
            await supabase.from('game_schedules').update(payload).eq('id', editTarget.id)
        } else {
            await supabase.from('game_schedules').insert({ user_id: user.id, ...payload })
        }
        setSaving(false); setModalOpen(false); load()
    }

    const remove = async (id: string) => {
        await supabase.from('game_schedules').update({ is_active: false }).eq('id', id)
        setDeleteId(null); load()
    }

    const avatar = user?.user_metadata?.avatar_url
    const name = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'Usuário'

    return (
        <>
            {/* Header */}
            <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {avatar ? (
                            <img src={avatar} alt={name} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#16a34a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>
                                {name[0].toUpperCase()}
                            </div>
                        )}
                        <div>
                            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>BEM-VINDO</div>
                            <div style={{ fontSize: 15, fontWeight: 800 }}>{name}</div>
                        </div>
                    </div>
                    <button onClick={signOut} style={{ background: 'none', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
                        Sair
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                    <div>
                        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Minhas Peladas</h1>
                        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{schedules.length} {schedules.length === 1 ? 'horário' : 'horários'} cadastrados</p>
                    </div>
                    <button className="btn btn-primary" style={{ padding: '10px 16px' }} onClick={openAdd}>
                        <Plus size={17} /> Nova Pelada
                    </button>
                </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', paddingBottom: 32 }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}><span className="spinner" /></div>
                ) : schedules.length === 0 ? (
                    <div className="empty-state" style={{ paddingTop: 60 }}>
                        <div className="icon">⚽</div>
                        <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Nenhuma pelada ainda</p>
                        <p>Crie seu primeiro horário de jogo e<br />comece a organizar sua turma!</p>
                        <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={openAdd}><Plus size={16} /> Criar Pelada</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {schedules.map(s => {
                            const ppt = s.players_per_team ?? 5
                            return (
                                <div
                                    key={s.id}
                                    className="card"
                                    onClick={() => onSelect(s)}
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', transition: 'box-shadow 0.15s' }}
                                >
                                    {/* Day badge */}
                                    <div style={{ width: 52, height: 52, borderRadius: 12, background: '#16a34a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>{DAYS_SHORT[s.day_of_week]}</span>
                                        <span style={{ fontSize: 20 }}>⚽</span>
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 800, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px', marginTop: 3 }}>
                                            <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                <Clock size={11} /> {DAYS[s.day_of_week]} · {s.start_time.slice(0, 5)}{s.end_time ? ` – ${s.end_time.slice(0, 5)}` : ''}
                                            </span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                <Users size={11} /> {ppt}v{ppt}
                                            </span>
                                            {s.location && (
                                                <span style={{ fontSize: 12, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                    <MapPin size={11} /> {s.location}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Quick actions + chevron */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                        <button
                                            onClick={e => openEdit(s, e)}
                                            style={{ background: '#f3f4f6', border: 'none', borderRadius: 7, padding: 7, cursor: 'pointer', color: '#6b7280', display: 'flex' }}
                                        >
                                            <Pencil size={13} />
                                        </button>
                                        <button
                                            onClick={e => { e.stopPropagation(); setDeleteId(s.id) }}
                                            style={{ background: '#fee2e2', border: 'none', borderRadius: 7, padding: 7, cursor: 'pointer', color: '#dc2626', display: 'flex' }}
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                        <ChevronRight size={16} color="#9ca3af" style={{ marginLeft: 4 }} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Editar Pelada' : 'Nova Pelada'}>
                <div className="form-group">
                    <label className="form-label">Nome da pelada *</label>
                    <input className="form-input" placeholder="Ex: Pelada do Zeca – Campo Sintético" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
                </div>
                <div className="form-group">
                    <label className="form-label">Dia da semana</label>
                    <select className="form-input" value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: +e.target.value }))}>
                        {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                        <label className="form-label">Início *</label>
                        <input className="form-input" type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Fim</label>
                        <input className="form-input" type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Formato da partida</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {PLAYERS_PRESETS.map(n => (
                            <button key={n} type="button" onClick={() => setForm(f => ({ ...f, players_per_team: n }))}
                                style={{ padding: '7px 13px', borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontWeight: 700, fontSize: 13, transition: 'all 0.15s',
                                    borderColor: form.players_per_team === n ? '#16a34a' : '#e5e7eb',
                                    background: form.players_per_team === n ? '#dcfce7' : 'white',
                                    color: form.players_per_team === n ? '#15803d' : '#374151' }}>
                                {n}v{n}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Local</label>
                    <input className="form-input" placeholder="Ex: Quadra do bairro" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Observações</label>
                    <textarea className="form-input" placeholder="Informações extras..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModalOpen(false)}>Cancelar</button>
                    <button className="btn btn-primary" style={{ flex: 2 }} onClick={save} disabled={saving || !form.title.trim()}>
                        {saving ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : editTarget ? 'Salvar' : 'Criar Pelada'}
                    </button>
                </div>
            </Modal>

            {/* Delete confirm */}
            <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Remover pelada?">
                <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 15 }}>A pelada e todos os jogadores/presenças vinculados serão removidos.</p>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setDeleteId(null)}>Cancelar</button>
                    <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => deleteId && remove(deleteId)}>Remover</button>
                </div>
            </Modal>
        </>
    )
}
