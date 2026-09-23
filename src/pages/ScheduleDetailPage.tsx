import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, Plus, Pencil, Trash2, Shuffle, AlertTriangle, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Player, GameSchedule, MatchAttendee, PlayerPosition, AttendanceStatus } from '../types'
import {
    drawTeams,
    saveDrawResult,
    loadDrawResult,
    clearDrawResult,
    formatForWhatsApp,
    type TeamDrawResult,
} from '../lib/teamDraw'
import StarRating from '../components/StarRating'
import Modal from '../components/Modal'

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
type DetailTab = 'players' | 'attendance' | 'draw'

function initials(name: string) {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}
function StarsRow({ value }: { value: number }) {
    return (
        <span style={{ fontSize: 13, letterSpacing: '-0.5px', lineHeight: 1 }}>
            <span style={{ color: '#f59e0b' }}>{'★'.repeat(value)}</span>
            <span style={{ color: '#e5e7eb' }}>{'★'.repeat(5 - value)}</span>
        </span>
    )
}
function nextOccurrence(dayOfWeek: number) {
    const today = new Date()
    // diff = 0 means today is the scheduled day → show today
    const diff = (dayOfWeek - today.getDay() + 7) % 7
    const d = new Date(today)
    d.setDate(today.getDate() + diff)
    return d.toISOString().slice(0, 10)
}

// ══════════════════════════════════════════════
// PLAYERS TAB
// ══════════════════════════════════════════════

const EMPTY_FORM = { name: '', nickname: '', position: 'linha' as PlayerPosition, stars: 3 }

// ── Parser: reads TXT or CSV, detects "Goleiro" marker ──────────
type ParsedPlayer = { name: string; position: PlayerPosition; stars: 3 }

function parsePlayersFromText(text: string): ParsedPlayer[] {
    return text
        .split(/[\n\r]+/)                  // split on newlines
        .flatMap(line => line.split(','))   // also handle comma-separated CSV
        .map(e => e.trim())
        .filter(e => e.length > 1)
        .map(entry => {
            const isGoleiro = /goleiro/i.test(entry)
            const name = entry
                .replace(/\s*[-–|]\s*goleiro\s*/gi, '')   // "Nome - Goleiro"
                .replace(/\s+goleiro\s*$/gi, '')            // "Nome Goleiro" (trailing)
                .replace(/^goleiro\s+/gi, '')               // "Goleiro Nome" (leading)
                .trim()
            if (!name) return null
            return { name, position: (isGoleiro ? 'goleiro' : 'linha') as PlayerPosition, stars: 3 as const }
        })
        .filter((p): p is ParsedPlayer => p !== null)
}

function PlayersTab({ scheduleId, players, loading, onRefresh }: {
    scheduleId: string; players: Player[]; loading: boolean; onRefresh: () => void
}) {
    const { user } = useAuth()
    const [filter, setFilter] = useState<'todos' | 'goleiro' | 'linha'>('todos')
    const [search, setSearch] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<Player | null>(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    // ── Import states
    const [importOpen, setImportOpen] = useState(false)
    const [importParsed, setImportParsed] = useState<ParsedPlayer[]>([])
    const [importLoading, setImportLoading] = useState(false)
    const [importError, setImportError] = useState('')

    // ── Remove-all states
    const [removeAllOpen, setRemoveAllOpen] = useState(false)
    const [removingAll, setRemovingAll] = useState(false)

    const openAdd  = () => { setEditTarget(null); setForm(EMPTY_FORM); setModalOpen(true) }
    const openEdit = (p: Player) => { setEditTarget(p); setForm({ name: p.name, nickname: p.nickname ?? '', position: p.position, stars: p.stars }); setModalOpen(true) }

    const save = async () => {
        if (!form.name.trim() || !user) return
        setSaving(true)
        const payload = { name: form.name.trim(), nickname: form.nickname.trim() || null, position: form.position, stars: form.stars }
        if (editTarget) {
            await supabase.from('players').update(payload).eq('id', editTarget.id)
        } else {
            await supabase.from('players').insert({ user_id: user.id, schedule_id: scheduleId, ...payload })
        }
        setSaving(false); setModalOpen(false); onRefresh()
    }

    const archive = async (id: string) => {
        await supabase.from('players').update({ is_active: false }).eq('id', id)
        setDeleteId(null); onRefresh()
    }

    // ── File import handler
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setImportError('')
        const reader = new FileReader()
        reader.onload = ev => {
            const text = ev.target?.result as string
            const parsed = parsePlayersFromText(text)
            if (parsed.length === 0) {
                setImportError('Nenhum nome encontrado no arquivo. Verifique o formato.')
            } else {
                setImportParsed(parsed)
            }
        }
        reader.readAsText(file, 'UTF-8')
        // Reset input so same file can be re-selected
        e.target.value = ''
    }

    const doImport = async () => {
        if (!user || !importParsed.length) return
        setImportLoading(true)
        const rows = importParsed.map(p => ({
            user_id: user.id,
            schedule_id: scheduleId,
            name: p.name,
            position: p.position,
            stars: p.stars,
            is_active: true,
        }))
        await supabase.from('players').insert(rows)
        setImportLoading(false)
        setImportOpen(false)
        setImportParsed([])
        onRefresh()
    }

    const openImport = () => { setImportParsed([]); setImportError(''); setImportOpen(true) }

    // ── Remove all
    const doRemoveAll = async () => {
        if (!players.length) return
        setRemovingAll(true)
        await supabase.from('players').update({ is_active: false }).eq('schedule_id', scheduleId)
        setRemovingAll(false)
        setRemoveAllOpen(false)
        onRefresh()
    }

    const countGK = players.filter(p => p.position === 'goleiro').length
    const countLN = players.filter(p => p.position === 'linha').length
    const visible = players
        .filter(p => filter === 'todos' || p.position === filter)
        .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.nickname ?? '').toLowerCase().includes(search.toLowerCase()))

    return (
        <>
            <div style={{ padding: '12px 16px 8px' }}>
                {/* Action bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    <p style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>{players.length} total · {countGK} GK · {countLN} Linha</p>
                    <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 12 }} onClick={openImport}>
                        📥 Importar
                    </button>
                    {players.length > 0 && (
                        <button
                            onClick={() => setRemoveAllOpen(true)}
                            style={{ padding: '7px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: '#fee2e2', color: '#dc2626' }}
                        >
                            🗑️ Remover todos
                        </button>
                    )}
                    <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={openAdd}>
                        <Plus size={15} /> Novo
                    </button>
                </div>

                {/* Filter chips */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {([{ id: 'todos', label: `Todos (${players.length})` }, { id: 'goleiro', label: `🧤 GK (${countGK})` }, { id: 'linha', label: `⚽ Linha (${countLN})` }] as const).map(f => (
                        <button key={f.id} onClick={() => setFilter(f.id)}
                            style={{ padding: '5px 11px', borderRadius: 100, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', background: filter === f.id ? '#16a34a' : '#f3f4f6', color: filter === f.id ? 'white' : '#374151' }}>
                            {f.label}
                        </button>
                    ))}
                </div>
                <input className="form-input" placeholder="Buscar jogador..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '8px 12px', fontSize: 13 }} />
            </div>

            {/* Player table */}
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><span className="spinner" /></div>
            ) : visible.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">👥</div>
                    <p style={{ fontWeight: 700, marginBottom: 6 }}>{search ? 'Sem resultados' : 'Nenhum jogador ainda'}</p>
                    <p style={{ fontSize: 13 }}>Use "+ Novo" ou "📥 Importar" para adicionar.</p>
                </div>
            ) : (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 68px 50px', padding: '5px 14px', borderBottom: '1px solid #f3f4f6' }}>
                        {['Jogador', 'Pos.', 'Nível', ''].map((h, i) => (
                            <span key={i} style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: i > 0 ? 'center' : 'left' }}>{h}</span>
                        ))}
                    </div>
                    {visible.map((p, i) => (
                        <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 50px 68px 50px', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #f9fafb', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, background: p.position === 'goleiro' ? '#fef3c7' : '#dbeafe', color: p.position === 'goleiro' ? '#92400e' : '#1e40af' }}>
                                    {p.position === 'goleiro' ? '🧤' : initials(p.name)}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                    {p.nickname && <div style={{ fontSize: 11, color: '#9ca3af' }}>"{p.nickname}"</div>}
                                </div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: p.position === 'goleiro' ? '#fef3c7' : '#dcfce7', color: p.position === 'goleiro' ? '#92400e' : '#15803d' }}>
                                    {p.position === 'goleiro' ? 'GK' : 'LN'}
                                </span>
                            </div>
                            <div style={{ textAlign: 'center' }}><StarsRow value={p.stars} /></div>
                            <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                                <button onClick={() => openEdit(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af' }}><Pencil size={13} /></button>
                                <button onClick={() => setDeleteId(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#fca5a5' }}><Trash2 size={13} /></button>
                            </div>
                        </div>
                    ))}
                    <div style={{ padding: '8px 14px', fontSize: 12, color: '#d1d5db', textAlign: 'center' }}>{visible.length} jogador{visible.length !== 1 ? 'es' : ''}</div>
                </div>
            )}

            {/* ── Add/Edit Modal ── */}
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Editar Jogador' : 'Novo Jogador'}>
                <div className="form-group"><label className="form-label">Nome *</label>
                    <input className="form-input" placeholder="Ex: João Silva" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                </div>
                <div className="form-group"><label className="form-label">Apelido</label>
                    <input className="form-input" placeholder="Ex: Jão" value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} />
                </div>
                <div className="form-group"><label className="form-label">Posição</label>
                    <div className="pos-toggle">
                        <button type="button" className={`pos-btn ${form.position === 'goleiro' ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, position: 'goleiro' }))}>🧤 Goleiro</button>
                        <button type="button" className={`pos-btn ${form.position === 'linha' ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, position: 'linha' }))}>⚽ Linha</button>
                    </div>
                </div>
                <div className="form-group"><label className="form-label">Nível de habilidade</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <StarRating value={form.stars} onChange={n => setForm(f => ({ ...f, stars: n }))} size={28} />
                        <span style={{ fontSize: 13, color: '#6b7280' }}>{form.stars}/5</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModalOpen(false)}>Cancelar</button>
                    <button className="btn btn-primary" style={{ flex: 2 }} onClick={save} disabled={saving || !form.name.trim()}>
                        {saving ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : editTarget ? 'Salvar' : 'Adicionar'}
                    </button>
                </div>
            </Modal>

            {/* ── Delete single Modal ── */}
            <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Remover jogador?">
                <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 15 }}>O jogador será arquivado desta pelada.</p>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setDeleteId(null)}>Cancelar</button>
                    <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => deleteId && archive(deleteId)}>Remover</button>
                </div>
            </Modal>

            {/* ── Import Modal ── */}
            <Modal open={importOpen} onClose={() => { setImportOpen(false); setImportParsed([]) }} title="📥 Importar Jogadores">
                {importParsed.length === 0 ? (
                    <>
                        <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
                            Selecione um arquivo <strong>.txt</strong> ou <strong>.csv</strong> com um nome por linha.<br />
                            Para goleiros, adicione "Goleiro" após o nome:
                        </p>
                        <div style={{ background: '#f9fafb', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, fontFamily: 'monospace', color: '#374151', lineHeight: '1.8' }}>
                            João Silva<br />
                            Pedro Nunes<br />
                            Marcos - Goleiro<br />
                            Carlos Goleiro
                        </div>

                        {importError && (
                            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
                                {importError}
                            </div>
                        )}

                        <label style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '12px', borderRadius: 12, border: '2px dashed #d1d5db',
                            cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#6b7280',
                            background: '#fafafa', marginBottom: 12,
                        }}>
                            📂 Selecionar arquivo (.txt ou .csv)
                            <input type="file" accept=".txt,.csv,text/plain,text/csv" style={{ display: 'none' }} onChange={handleFileChange} />
                        </label>

                        <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => setImportOpen(false)}>Cancelar</button>
                    </>
                ) : (
                    <>
                        <p style={{ fontSize: 14, color: '#374151', marginBottom: 12 }}>
                            <strong>{importParsed.length} jogadores</strong> encontrados. Confirme antes de importar:
                        </p>

                        {/* Preview list */}
                        <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #f3f4f6', borderRadius: 10, marginBottom: 16 }}>
                            {importParsed.map((p, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderBottom: '1px solid #f9fafb', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                                    <span style={{ fontSize: 16 }}>{p.position === 'goleiro' ? '🧤' : '⚽'}</span>
                                    <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: p.position === 'goleiro' ? '#fef3c7' : '#dcfce7', color: p.position === 'goleiro' ? '#92400e' : '#15803d' }}>
                                        {p.position === 'goleiro' ? 'GK' : 'LN'}
                                    </span>
                                    <span style={{ fontSize: 12, color: '#f59e0b' }}>★★★</span>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setImportParsed([])}>← Voltar</button>
                            <button className="btn btn-primary" style={{ flex: 2 }} onClick={doImport} disabled={importLoading}>
                                {importLoading
                                    ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                                    : `✅ Importar ${importParsed.length} jogadores`}
                            </button>
                        </div>
                    </>
                )}
            </Modal>

            {/* ── Remove All Modal ── */}
            <Modal open={removeAllOpen} onClose={() => setRemoveAllOpen(false)} title="🗑️ Remover todos?">
                <p style={{ color: '#6b7280', marginBottom: 6, fontSize: 15 }}>
                    Todos os <strong>{players.length} jogadores</strong> desta pelada serão arquivados.
                </p>
                <p style={{ color: '#9ca3af', marginBottom: 24, fontSize: 13 }}>
                    Esta ação não pode ser desfeita pela interface.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setRemoveAllOpen(false)}>Cancelar</button>
                    <button className="btn btn-danger" style={{ flex: 1 }} onClick={doRemoveAll} disabled={removingAll}>
                        {removingAll ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: 'white' }} /> : 'Remover todos'}
                    </button>
                </div>
            </Modal>
        </>
    )
}


// ══════════════════════════════════════════════
// ATTENDANCE TAB
// ══════════════════════════════════════════════

function AttendanceTab({ schedule, players }: { schedule: GameSchedule; players: Player[] }) {
    const [dateInput, setDateInput] = useState(() => nextOccurrence(schedule.day_of_week))
    const [attendees, setAttendees] = useState<MatchAttendee[]>([])
    const [loading, setLoading] = useState(false)

    const loadAttendees = useCallback(async () => {
        if (!dateInput) return
        setLoading(true)
        const { data } = await supabase.from('match_attendees').select('*').eq('schedule_id', schedule.id).eq('game_date', dateInput)
        setAttendees(data ?? [])
        setLoading(false)
    }, [schedule.id, dateInput])

    useEffect(() => { loadAttendees() }, [loadAttendees])

    const isConfirmed = (pid: string) =>
        attendees.find(a => a.player_id === pid)?.status === 'confirmado'

    const toggle = async (pid: string) => {
        const confirmed = isConfirmed(pid)
        const newStatus: AttendanceStatus = confirmed ? 'ausente' : 'confirmado'
        await supabase.from('match_attendees').upsert(
            { schedule_id: schedule.id, player_id: pid, game_date: dateInput, status: newStatus },
            { onConflict: 'schedule_id,player_id,game_date' }
        )
        setAttendees(prev => {
            const has = prev.find(a => a.player_id === pid)
            return has
                ? prev.map(a => a.player_id === pid ? { ...a, status: newStatus } : a)
                : [...prev, { id: '', schedule_id: schedule.id, player_id: pid, game_date: dateInput, status: newStatus, created_at: '' }]
        })
    }

    const confirmedPlayers = players.filter(p => isConfirmed(p.id))
    const countC = confirmedPlayers.length
    const countA = players.length - countC
    const ppt = schedule.players_per_team ?? 5

    return (
        <div>
            {/* Date picker */}
            <div style={{ padding: '12px 16px 8px' }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Data do jogo</label>
                <input className="form-input" type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} style={{ padding: '9px 12px' }} />
            </div>

            {/* Summary – 2 columns only */}
            <div style={{ margin: '0 16px 10px', background: '#f9fafb', borderRadius: 12, padding: '10px 14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: '#16a34a' }}>{countC}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700 }}>CONFIRMADOS</div>
                    </div>
                    <div style={{ textAlign: 'center', borderLeft: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: '#9ca3af' }}>{countA}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700 }}>NÃO CONFIRMADOS</div>
                    </div>
                </div>
                {countC > 0 && (
                    <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 8, paddingTop: 8, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>⚽ <strong>{ppt}v{ppt}</strong></span>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>🧤 <strong>{confirmedPlayers.filter(p => p.position === 'goleiro').length}</strong> GK</span>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>★ média <strong>{(confirmedPlayers.reduce((s, p) => s + p.stars, 0) / countC).toFixed(1)}</strong></span>
                    </div>
                )}
            </div>

            {/* Player list */}
            {players.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">👥</div>
                    <p style={{ fontWeight: 700 }}>Sem jogadores cadastrados</p>
                    <p style={{ fontSize: 13 }}>Adicione jogadores na aba Jogadores primeiro.</p>
                </div>
            ) : loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><span className="spinner" /></div>
            ) : (
                <div style={{ padding: '0 16px' }}>
                    {players.map(p => {
                        const confirmed = isConfirmed(p.id)
                        return (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #f3f4f6' }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, background: p.position === 'goleiro' ? '#fef3c7' : '#dbeafe', color: p.position === 'goleiro' ? '#92400e' : '#1e40af' }}>
                                    {p.position === 'goleiro' ? '🧤' : initials(p.name)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                    <StarsRow value={p.stars} />
                                </div>
                                <button
                                    onClick={() => toggle(p.id)}
                                    style={{
                                        padding: '7px 14px', borderRadius: 100, border: 'none', cursor: 'pointer',
                                        fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', transition: 'all 0.15s',
                                        background: confirmed ? '#16a34a' : '#f3f4f6',
                                        color: confirmed ? 'white' : '#9ca3af',
                                    }}
                                >
                                    {confirmed ? '✅ Confirmado' : '+ Confirmar'}
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ══════════════════════════════════════════════
// DRAW TAB
// ══════════════════════════════════════════════

function TeamCard({ team }: { team: TeamDrawResult['teams'][0] }) {
    const gk = team.players.find(p => p.position === 'goleiro')
    const rest = team.players.filter(p => p !== gk)
    return (
        <div style={{ border: `2px solid ${team.color}20`, borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
            {/* Header */}
            <div style={{ background: team.color, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <div style={{ color: 'white', fontWeight: 900, fontSize: 16 }}>{team.label}</div>
                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{team.players.length} jogadores</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>MÉDIA</div>
                    <div style={{ color: 'white', fontWeight: 900, fontSize: 20 }}>★ {team.avg}</div>
                </div>
            </div>
            {/* Players */}
            {gk && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: '#fef9c3', borderBottom: '1px solid #fef08a' }}>
                    <span style={{ fontSize: 18 }}>🧤</span>
                    <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 800, fontSize: 13 }}>{gk.name}</span>
                        {gk.nickname && <span style={{ color: '#92400e', fontSize: 12 }}> "{gk.nickname}"</span>}
                    </div>
                    <StarsRow value={gk.stars} />
                </div>
            )}
            {rest.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderBottom: '1px solid #f9fafb' }}>
                    <span style={{ fontSize: 16 }}>⚽</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</span>
                        {p.nickname && <span style={{ color: '#9ca3af', fontSize: 12 }}> "{p.nickname}"</span>}
                    </div>
                    <StarsRow value={p.stars} />
                </div>
            ))}
        </div>
    )
}

function SuplentesCard({ players }: { players: Player[] }) {
    if (!players.length) return null
    return (
        <div style={{ border: '1.5px solid #e5e7eb', borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}>
            <div style={{ background: '#f3f4f6', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <div style={{ fontWeight: 900, fontSize: 15, color: '#374151' }}>⏳ Suplentes</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>Próximos a entrar</div>
                </div>
                <span style={{ fontWeight: 800, fontSize: 20, color: '#9ca3af' }}>{players.length}</span>
            </div>
            {players.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderBottom: '1px solid #f9fafb' }}>
                    <span style={{ fontSize: 16 }}>{p.position === 'goleiro' ? '🧤' : '⚽'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</span>
                        {p.nickname && <span style={{ color: '#9ca3af', fontSize: 12 }}> "{p.nickname}"</span>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: p.position === 'goleiro' ? '#fef3c7' : '#f3f4f6', color: p.position === 'goleiro' ? '#92400e' : '#6b7280' }}>
                        {p.position === 'goleiro' ? 'GK' : 'LN'}
                    </span>
                    <StarsRow value={p.stars} />
                </div>
            ))}
        </div>
    )
}

function DrawTab({ schedule, players }: { schedule: GameSchedule; players: Player[] }) {
    const [dateInput, setDateInput] = useState(() => nextOccurrence(schedule.day_of_week))
    const [attendees, setAttendees] = useState<MatchAttendee[]>([])
    const [loadingAtt, setLoadingAtt] = useState(false)
    const [result, setResult] = useState<TeamDrawResult | null>(null)
    const [error, setError] = useState('')
    const [copied, setCopied] = useState(false)

    // ── Load attendees when date changes ──
    const loadAttendees = useCallback(async () => {
        if (!dateInput) return
        setLoadingAtt(true)
        const { data } = await supabase.from('match_attendees').select('*').eq('schedule_id', schedule.id).eq('game_date', dateInput)
        setAttendees(data ?? [])
        setLoadingAtt(false)
    }, [schedule.id, dateInput])

    useEffect(() => { loadAttendees() }, [loadAttendees])

    // ── Restore persisted draw when date changes ──
    useEffect(() => {
        setResult(loadDrawResult(schedule.id, dateInput))
        setError('')
    }, [schedule.id, dateInput])

    // ── Derived stats ──
    const ppt = schedule.players_per_team ?? 5
    const confirmed = players.filter(p => attendees.find(a => a.player_id === p.id && a.status === 'confirmado'))
    const gkCount   = confirmed.filter(p => p.position === 'goleiro').length
    const lineCount = confirmed.filter(p => p.position === 'linha').length

    // Preview of how many teams will be formed
    const numTeamsPreview = Math.min(Math.floor(confirmed.length / ppt), gkCount)
    const suplentesPreview = confirmed.length - (numTeamsPreview * ppt)

    const okGK    = gkCount >= 2
    const okTotal = confirmed.length >= ppt * 2

    // ── Draw handler ──
    const handleDraw = () => {
        setError('')
        try {
            const r = drawTeams(confirmed, ppt, schedule.title, dateInput)
            setResult(r)
            saveDrawResult(schedule.id, dateInput, r)
        } catch (e: any) {
            setError(e.message ?? 'Erro inesperado ao sortear.')
            setResult(null)
        }
    }

    const handleRedraw = () => {
        clearDrawResult(schedule.id, dateInput)
        handleDraw()
    }

    // ── Copy to clipboard ──
    const copyWhatsApp = async () => {
        if (!result) return
        try {
            await navigator.clipboard.writeText(formatForWhatsApp(result))
            setCopied(true)
            setTimeout(() => setCopied(false), 2500)
        } catch {
            alert('Não foi possível copiar. Verifique as permissões do navegador.')
        }
    }

    // ── Min diff between teams ──
    const maxDiff = result
        ? Math.max(...result.teams.map(t => t.avg)) - Math.min(...result.teams.map(t => t.avg))
        : 0

    return (
        <div style={{ padding: '12px 16px' }}>
            {/* Date picker */}
            <div className="form-group">
                <label className="form-label">Data do jogo</label>
                <input className="form-input" type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} style={{ padding: '9px 12px' }} />
            </div>

            {/* Stats panel */}
            <div style={{ background: '#f9fafb', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8 }}>Confirmados nesta data</div>
                {loadingAtt ? (
                    <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                ) : (
                    <>
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: numTeamsPreview >= 2 ? 8 : 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>✅ {confirmed.length} confirmados</span>
                            <span style={{ fontSize: 13, color: '#6b7280' }}>🧤 {gkCount} goleiro{gkCount !== 1 ? 's' : ''}</span>
                            <span style={{ fontSize: 13, color: '#6b7280' }}>⚽ {lineCount} linha</span>
                        </div>
                        {numTeamsPreview >= 2 && (
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, background: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: 100, fontWeight: 700 }}>
                                    🏆 {numTeamsPreview} times de {ppt}
                                </span>
                                {suplentesPreview > 0 && (
                                    <span style={{ fontSize: 12, background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: 100, fontWeight: 700 }}>
                                        ⏳ {suplentesPreview} suplente{suplentesPreview !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Validation checklist */}
            <div style={{ marginBottom: 14 }}>
                {[
                    { ok: okGK,    text: `Mínimo 2 goleiros confirmados — ${gkCount}/2` },
                    { ok: okTotal, text: `Mínimo ${ppt * 2} jogadores para ${ppt}v${ppt} — ${confirmed.length}/${ppt * 2}` },
                ].map(({ ok, text }, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 15 }}>{ok ? '✅' : '❌'}</span>
                        <span style={{ fontSize: 13, color: ok ? '#374151' : '#dc2626', fontWeight: ok ? 400 : 600 }}>{text}</span>
                    </div>
                ))}
            </div>

            {/* Error alert */}
            {error && (
                <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{error}</span>
                </div>
            )}

            {/* Draw / Redraw button */}
            {result ? (
                <button className="btn btn-ghost" style={{ width: '100%', marginBottom: 16, fontSize: 14, padding: '12px', border: '1.5px solid #e5e7eb' }} onClick={handleRedraw}>
                    <Shuffle size={16} /> 🔄 Sortear Novamente
                </button>
            ) : (
                <button className="btn btn-primary" style={{ width: '100%', marginBottom: 16, fontSize: 15, padding: '14px' }} onClick={handleDraw} disabled={!okGK || !okTotal}>
                    <Shuffle size={18} /> ⚡ Sortear Times
                </button>
            )}

            {/* ── RESULTS ── */}
            {result && (
                <>
                    {/* Balance bar */}
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        <span style={{ fontSize: 13, color: '#15803d', fontWeight: 700 }}>
                            {result.numTeams} times · {result.playersPerTeam} jogadores cada
                        </span>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>
                            Dif. de média: <strong>{maxDiff.toFixed(1)} ★</strong>
                        </span>
                    </div>

                    {/* Team cards */}
                    {result.teams.map(team => (
                        <TeamCard key={team.label} team={team} />
                    ))}

                    {/* Suplentes */}
                    <SuplentesCard players={result.suplentes} />

                    {/* Share buttons */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <button
                            onClick={copyWhatsApp}
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                                background: copied ? '#dcfce7' : '#25D366',
                                color: copied ? '#15803d' : 'white',
                                transition: 'all 0.2s',
                            }}
                        >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                            {copied ? 'Copiado!' : '📋 Copiar para WhatsApp'}
                        </button>
                    </div>

                    {/* Drawn at timestamp */}
                    <p style={{ fontSize: 11, color: '#d1d5db', textAlign: 'center', marginTop: 12 }}>
                        Sorteado em {new Date(result.drawnAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                </>
            )}
        </div>
    )
}

// ══════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════

export default function ScheduleDetailPage({ schedule, onBack }: { schedule: GameSchedule; onBack: () => void }) {
    const [tab, setTab] = useState<DetailTab>('players')
    const [players, setPlayers] = useState<Player[]>([])
    const [playersLoading, setPlayersLoading] = useState(true)

    const loadPlayers = useCallback(async () => {
        setPlayersLoading(true)
        const { data } = await supabase.from('players').select('*').eq('schedule_id', schedule.id).eq('is_active', true).order('name')
        setPlayers(data ?? [])
        setPlayersLoading(false)
    }, [schedule.id])

    useEffect(() => { loadPlayers() }, [loadPlayers])

    const ppt = schedule.players_per_team ?? 5
    const TABS: { id: DetailTab; icon: string; label: string }[] = [
        { id: 'players',    icon: '👥', label: 'Jogadores' },
        { id: 'attendance', icon: '✅', label: 'Presença'  },
        { id: 'draw',       icon: '⚡', label: 'Sortear'   },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'white', maxWidth: 480, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ flexShrink: 0, borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 10px' }}>
                    <button onClick={onBack} style={{ background: '#f3f4f6', border: 'none', borderRadius: 10, padding: 8, cursor: 'pointer', display: 'flex' }}>
                        <ArrowLeft size={18} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h1 style={{ fontSize: 17, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{schedule.title}</h1>
                        <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                            {DAYS[schedule.day_of_week]} · {schedule.start_time.slice(0, 5)}{schedule.end_time ? ` – ${schedule.end_time.slice(0, 5)}` : ''} · ⚽ {ppt}v{ppt}
                            {schedule.location ? ` · ${schedule.location}` : ''}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex' }}>
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)} style={{
                            flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                            padding: '8px 4px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                            fontSize: 12, fontWeight: 700,
                            color: tab === t.id ? '#16a34a' : '#9ca3af',
                            borderBottom: `2.5px solid ${tab === t.id ? '#16a34a' : 'transparent'}`,
                            transition: 'all 0.15s',
                        }}>
                            <span style={{ fontSize: 18 }}>{t.icon}</span>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 32 }}>
                {tab === 'players'    && <PlayersTab scheduleId={schedule.id} players={players} loading={playersLoading} onRefresh={loadPlayers} />}
                {tab === 'attendance' && <AttendanceTab schedule={schedule} players={players} />}
                {tab === 'draw'       && <DrawTab schedule={schedule} players={players} />}
            </div>
        </div>
    )
}
