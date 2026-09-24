interface Props {
    value: number        // 0–5 (supports .5 increments)
    onChange?: (n: number) => void
    size?: number
    readOnly?: boolean
}

export default function StarRating({ value, onChange, size = 28, readOnly = false }: Props) {
    const handleStep = (delta: number) => {
        if (!onChange || readOnly) return
        const next = Math.min(5, Math.max(0, Math.round((value + delta) * 2) / 2))
        onChange(next)
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {/* Stars row + stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {!readOnly && (
                    <button
                        type="button"
                        onClick={() => handleStep(-0.5)}
                        disabled={value <= 0}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            border: '1.5px solid #e5e7eb',
                            background: 'white',
                            cursor: value <= 0 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            fontWeight: 800,
                            color: '#4b5563',
                            flexShrink: 0,
                        }}
                        title="Diminuir meia estrela (-0.5)"
                    >
                        −
                    </button>
                )}

                <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    {[1, 2, 3, 4, 5].map(star => {
                        const isFull = value >= star
                        const isHalf = !isFull && value >= star - 0.5
                        const gradId = `star-grad-${star}`

                        return (
                            <div
                                key={star}
                                style={{
                                    position: 'relative',
                                    width: size,
                                    height: size,
                                    cursor: readOnly ? 'default' : 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <svg width={size} height={size} viewBox="0 0 24 24">
                                    <defs>
                                        <linearGradient id={gradId}>
                                            <stop offset="50%" stopColor="#f59e0b" />
                                            <stop offset="50%" stopColor="#e5e7eb" />
                                        </linearGradient>
                                    </defs>
                                    <path
                                        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                                        fill={isFull ? '#f59e0b' : isHalf ? `url(#${gradId})` : '#e5e7eb'}
                                    />
                                </svg>

                                {!readOnly && (
                                    <>
                                        {/* Left half: sets star - 0.5 */}
                                        <div
                                            onClick={() => onChange?.(star - 0.5)}
                                            style={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                width: '50%',
                                                height: '100%',
                                                cursor: 'pointer',
                                                zIndex: 2,
                                            }}
                                            title={`${star - 0.5} estrelas`}
                                        />
                                        {/* Right half: sets star */}
                                        <div
                                            onClick={() => onChange?.(star)}
                                            style={{
                                                position: 'absolute',
                                                right: 0,
                                                top: 0,
                                                width: '50%',
                                                height: '100%',
                                                cursor: 'pointer',
                                                zIndex: 2,
                                            }}
                                            title={`${star} estrelas`}
                                        />
                                    </>
                                )}
                            </div>
                        )
                    })}
                </div>

                {!readOnly && (
                    <button
                        type="button"
                        onClick={() => handleStep(0.5)}
                        disabled={value >= 5}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            border: '1.5px solid #e5e7eb',
                            background: 'white',
                            cursor: value >= 5 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            fontWeight: 800,
                            color: '#4b5563',
                            flexShrink: 0,
                        }}
                        title="Aumentar meia estrela (+0.5)"
                    >
                        +
                    </button>
                )}

                <span style={{ fontSize: 15, fontWeight: 900, color: '#d97706', minWidth: 32 }}>
                    {value.toFixed(1)}
                </span>
            </div>

            {/* Quick preset chips */}
            {!readOnly && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(v => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => onChange?.(v)}
                            style={{
                                padding: '3px 8px',
                                borderRadius: 6,
                                border: '1px solid',
                                borderColor: value === v ? '#f59e0b' : '#e5e7eb',
                                background: value === v ? '#fef3c7' : 'white',
                                color: value === v ? '#92400e' : '#6b7280',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                            }}
                        >
                            {v}★
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
