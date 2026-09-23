interface Props {
    value: number        // 0–5
    onChange?: (n: number) => void
    size?: number
    readOnly?: boolean
}

export default function StarRating({ value, onChange, size = 24, readOnly = false }: Props) {
    return (
        <div style={{ display: 'flex', gap: '2px' }}>
            {[1, 2, 3, 4, 5].map(star => (
                <button
                    key={star}
                    type="button"
                    className="star-btn"
                    style={{ fontSize: size, cursor: readOnly ? 'default' : 'pointer' }}
                    onClick={() => !readOnly && onChange?.(star === value ? 0 : star)}
                    aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
                    disabled={readOnly}
                >
                    {star <= value ? '⭐' : '☆'}
                </button>
            ))}
        </div>
    )
}
