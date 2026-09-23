import { Users, Calendar, ShieldCheck } from 'lucide-react'

export type Tab = 'players' | 'schedules' | 'attendance'

interface Props {
    active: Tab
    onChange: (t: Tab) => void
}

const tabs: { id: Tab; label: string; Icon: typeof Users }[] = [
    { id: 'players', label: 'Jogadores', Icon: Users },
    { id: 'schedules', label: 'Horários', Icon: Calendar },
    { id: 'attendance', label: 'Partida', Icon: ShieldCheck },
]

export default function BottomNav({ active, onChange }: Props) {
    return (
        <nav className="tab-bar">
            {tabs.map(({ id, label, Icon }) => (
                <button
                    key={id}
                    className={`tab-btn ${active === id ? 'active' : ''}`}
                    onClick={() => onChange(id)}
                >
                    <Icon size={22} />
                    <span>{label}</span>
                </button>
            ))}
        </nav>
    )
}
