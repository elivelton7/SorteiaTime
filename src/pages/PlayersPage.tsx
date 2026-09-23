import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Player, PlayerPosition } from '../types'
import StarRating from '../components/StarRating'
import Modal from '../components/Modal'

type Filter = 'todos' | 'goleiro' | 'linha'

function initials(name: string) {
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

/** Compact star display: ★★★☆☆ */
function StarsText({ value }: { value: number }) {
    return (
        <span style={{ fontSize: 13, letterSpacing: '-1px', color: '#f59e0b' }} title={`${value} estrelas`}>
            {'★'.repeat(value)}
            <span style={{ color: '#d1d5db' }}>{'★'.repeat(5 - value)}</span>
        </span>
    )
}

const EMPTY_FORM = { name: '', nickname: '', position: 'linha' as PlayerPosition, stars: 3 }

export default function PlayersPage() {
    const { user } = useAuth()
    const [players, setPlayers] = useState<Player[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<Filter>('todos')
    const [search, setSearch] = useState('')
    const [modalOpen, setModalOpen] = useState(false)
    const [editTarget, setEditTarget] = useState<Player | null>(null)
    const [form, setForm] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    const load = async () => {
        if (!user) return
        const { data } = await supabase
            .from('players')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('name')
        setPlayers(data ?? [])
        setLoading(false)
    }

    useEffect(() => { load() }, [user])

    const openAdd = () => { setEditTarget(null); setForm(EMPTY_FORM); setModalOpen(true) }
    const openEdit = (p: Player) => {
        setEditTarget(p)
        setForm({ name: p.name, nickname: p.nickname ?? '', position: p.position, stars: p.stars })
        setModalOpen(true)
    }

    const save = async () => {
        if (!form.name.trim() || !user) return
        setSaving(true)
        const payload = { name: form.name.trim(), nickname: form.nickname.trim() || null, position: form.position, stars: form.stars }
        if (editTarget) {
            await supabase.from('players').update(payload).eq('id', editTarget.id)
        } else {
            await supabase.from('players').insert({ user_id: user.id, ...payload })
        }
        setSaving(false); setModalOpen(false); load()
    }

    const archive = async (id: string) => {
        await supabase.from('players').update({ is_active: false }).eq('id', id)
        setDeleteId(null); load()
    }

    const countBy = (pos: PlayerPosition) => players.filter(p => p.position === pos).length

    const visible = players
        .filter(p => filter === 'todos' || p.position === filter)
        .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.nickname ?? '').toLowerCase().includes(search.toLowerCase()))

    return (
        <>
            {/* ── Header ── */}
            <div style={{ padding: '16px 16px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 900 }}>Jogadores</h1>
                        <p style={{ fontSize: 12, color: '#6b7280' }}>
                            {players.length} total · {countBy('goleiro')} GK · {countBy('linha')} Linha
                        </p>
                    </div>
                    <button className="btn btn-primary" style={{ padding: '9px 14px', fontSize: 14 }} onClick={openAdd}>
                        <Plus size={16} /> Novo
                    </button>
                </div>

                {/* Filter chips */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {([
                        { id: 'todos', label: `Todos (${players.length})` },
                        { id: 'goleiro', label: `🧤 GK (${countBy('goleiro')})` },
                        { id: 'linha', label: `⚽ Linha (${countBy('linha')})` },
                    ] as { id: Filter; label: string }[]).map(f => (
                        <button key={f.id} onClick={() => setFilter(f.id)}
                            style={{ padding: '6px 12px', borderRadius: 100, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, transition: 'all 0.15s', whiteSpace: 'nowrap',
                                background: filter === f.id ? '#16a34a' : '#f3f4f6',
                                color: filter === f.id ? 'white' : '#374151' }}>
                            {f.label}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div style={{ position: 'relative', marginBottom: 8 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                        className="form-input"
                        placeholder="Buscar jogador..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ padding: '8px 10px 8px 30px', fontSize: 13 }}
                    />
                </div>
            </div>

            {/* ── Compact table ── */}
            <div className="page-content" style={{ padding: '0 0 8px' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
                        <span className="spinner" />
                    </div>
                ) : visible.length === 0 ? (
                    <div className="empty-state">
                        <div className="icon">{search ? '🔍' : '👥'}</div>
                        <p style={{ fontWeight: 700, marginBottom: 6 }}>{search ? 'Nenhum resultado' : 'Nenhum jogador aqui'}</p>
                        <p style={{ fontSize: 13 }}>{search ? 'Tente outro nome.' : 'Toque em "Novo" para cadastrar.'}</p>
                    </div>
                ) : (
                    <div>
                        {/* Table header */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 70px 60px', alignItems: 'center', padding: '6px 14px', borderBottom: '1px solid #f3f4f6', marginBottom: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jogador</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Pos.</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Nível</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}></span>
                        </div>

                        {visible.map((p, i) => (
                            <div
                                key={p.id}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 60px 70px 60px',
                                    alignItems: 'center',
                                    padding: '8px 14px',
                                    borderBottom: '1px solid #f9fafb',
                                    background: i % 2 === 0 ? 'white' : '#fafafa',
                                    transition: 'background 0.1s',
                                }}
                            >
                                {/* Name + avatar */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    <div style={{
                                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 11, fontWeight: 800,
                                        background: p.position === 'goleiro' ? '#fef3c7' : '#dbeafe',
                                        color: p.position === 'goleiro' ? '#92400e' : '#1e40af',
                                    }}>
                                        {p.position === 'goleiro' ? '🧤' : initials(p.name)}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {p.name}
                                        </div>
                                        {p.nickname && (
                                            <div style={{ fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                "{p.nickname}"
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Position badge */}
                                <div style={{ textAlign: 'center' }}>
                                    <span style={{
                                        fontSize: 11, fontWeight: 700, padding: '3px 7px', borderRadius: 6,
                                        background: p.position === 'goleiro' ? '#fef3c7' : '#dcfce7',
                                        color: p.position === 'goleiro' ? '#92400e' : '#15803d',
                                    }}>
                                        {p.position === 'goleiro' ? 'GK' : 'LN'}
                                    </span>
                                </div>

                                {/* Stars compact */}
                                <div style={{ textAlign: 'center' }}>
                                    <StarsText value={p.stars} />
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                    <button
                                        onClick={() => openEdit(p)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#9ca3af', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                                        title="Editar"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    <button
                                        onClick={() => setDeleteId(p.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#fca5a5', borderRadius: 6, display: 'flex', alignItems: 'center' }}
                                        title="Remover"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        <div style={{ padding: '8px 14px', fontSize: 12, color: '#d1d5db', textAlign: 'center' }}>
                            {visible.length} jogador{visible.length !== 1 ? 'es' : ''} exibido{visible.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Add/Edit Modal ── */}
            <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Editar Jogador' : 'Novo Jogador'}>
                <div className="form-group">
                    <label className="form-label">Nome completo *</label>
                    <input className="form-input" placeholder="Ex: João Silva" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
                </div>
                <div className="form-group">
                    <label className="form-label">Apelido</label>
                    <input className="form-input" placeholder="Ex: Jão, Zico..." value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} />
                </div>
                <div className="form-group">
                    <label className="form-label">Posição</label>
                    <div className="pos-toggle">
                        <button type="button" className={`pos-btn ${form.position === 'goleiro' ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, position: 'goleiro' }))}>
                            🧤 Goleiro
                        </button>
                        <button type="button" className={`pos-btn ${form.position === 'linha' ? 'active' : ''}`} onClick={() => setForm(f => ({ ...f, position: 'linha' }))}>
                            ⚽ Linha
                        </button>
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Nível de habilidade</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <StarRating value={form.stars} onChange={n => setForm(f => ({ ...f, stars: n }))} size={28} />
                        <span style={{ fontSize: 13, color: '#6b7280' }}>{form.stars} de 5</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setModalOpen(false)}>Cancelar</button>
                    <button className="btn btn-primary" style={{ flex: 2 }} onClick={save} disabled={saving || !form.name.trim()}>
                        {saving ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> : editTarget ? 'Salvar' : 'Adicionar'}
                    </button>
                </div>
            </Modal>

            {/* ── Delete confirm ── */}
            <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Remover jogador?">
                <p style={{ color: '#6b7280', marginBottom: 24, fontSize: 15 }}>
                    O jogador será arquivado. Pode ser reativado pelo banco de dados se necessário.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setDeleteId(null)}>Cancelar</button>
                    <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => deleteId && archive(deleteId)}>Remover</button>
                </div>
            </Modal>
        </>
    )
}
