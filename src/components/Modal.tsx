import type { ReactNode } from 'react'

interface Props {
    open: boolean
    onClose: () => void
    title: string
    children: ReactNode
}

export default function Modal({ open, onClose, title, children }: Props) {
    if (!open) return null
    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-sheet">
                <div className="modal-handle" />
                <h2 style={{ fontWeight: 800, fontSize: 18, marginBottom: 20 }}>{title}</h2>
                {children}
            </div>
        </div>
    )
}
