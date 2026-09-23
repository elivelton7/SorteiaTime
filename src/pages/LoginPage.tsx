import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
    const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null)
    const [mode, setMode] = useState<'signin' | 'signup'>('signin')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPw, setShowPw] = useState(false)
    const [emailLoading, setEmailLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const signInSocial = async (provider: 'google' | 'facebook') => {
        setSocialLoading(provider)
        setError('')
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo: window.location.origin },
        })
        if (error) { setError(error.message); setSocialLoading(null) }
    }

    const handleEmail = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(''); setSuccess('')
        if (!email || !password) { setError('Preencha email e senha.'); return }
        setEmailLoading(true)

        if (mode === 'signup') {
            const { error } = await supabase.auth.signUp({ email, password })
            if (error) setError(error.message)
            else setSuccess('Conta criada! Verifique seu e-mail para confirmar (ou já entre se a confirmação estiver desativada).')
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) setError(error.message === 'Invalid login credentials' ? 'Email ou senha incorretos.' : error.message)
        }
        setEmailLoading(false)
    }

    return (
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', background: 'white' }}>
            {/* Logo */}
            <div style={{ fontSize: 64, marginBottom: 12 }}>⚽</div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: '#111827', marginBottom: 6 }}>Pelada Manager</h1>
            <p style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 36, maxWidth: 280 }}>
                Organize jogadores, horários e presenças.
            </p>

            {/* Error / Success */}
            {error && (
                <div style={{ background: '#fee2e2', color: '#991b1b', padding: '11px 16px', borderRadius: 10, marginBottom: 14, fontSize: 13, width: '100%', maxWidth: 340, textAlign: 'center' }}>
                    {error}
                </div>
            )}
            {success && (
                <div style={{ background: '#dcfce7', color: '#15803d', padding: '11px 16px', borderRadius: 10, marginBottom: 14, fontSize: 13, width: '100%', maxWidth: 340, textAlign: 'center' }}>
                    {success}
                </div>
            )}

            {/* ── Email/Senha ── */}
            <form onSubmit={handleEmail} style={{ width: '100%', maxWidth: 340, marginBottom: 20 }}>
                <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 10, padding: 4, marginBottom: 16 }}>
                    {(['signin', 'signup'] as const).map(m => (
                        <button key={m} type="button" onClick={() => { setMode(m); setError(''); setSuccess('') }}
                            style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                                background: mode === m ? 'white' : 'transparent',
                                color: mode === m ? '#111827' : '#6b7280',
                                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.15s' }}>
                            {m === 'signin' ? 'Entrar' : 'Criar conta'}
                        </button>
                    ))}
                </div>

                <div style={{ position: 'relative', marginBottom: 10 }}>
                    <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                        type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="seu@email.com" autoComplete="email"
                        style={{ width: '100%', padding: '12px 12px 12px 36px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                    />
                </div>

                <div style={{ position: 'relative', marginBottom: 14 }}>
                    <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                        type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="Senha (mínimo 6 caracteres)" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        style={{ width: '100%', padding: '12px 40px 12px 36px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4 }}>
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>

                <button type="submit" disabled={emailLoading}
                    style={{ width: '100%', padding: '13px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: emailLoading ? 0.7 : 1 }}>
                    {emailLoading
                        ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                        : mode === 'signin' ? '→ Entrar' : '✓ Criar conta'}
                </button>
            </form>

            {/* ── Divider ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 340, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>OU</span>
                <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
            </div>

            {/* ── Social ── */}
            <button onClick={() => signInSocial('google')} disabled={!!socialLoading}
                style={{ width: '100%', maxWidth: 340, marginBottom: 10, padding: '12px 20px', background: 'white', border: '1.5px solid #e5e7eb', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                {socialLoading === 'google'
                    ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                    : <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>}
                Continuar com Google
            </button>

            <button onClick={() => signInSocial('facebook')} disabled={!!socialLoading}
                style={{ width: '100%', maxWidth: 340, marginBottom: 28, padding: '12px 20px', background: '#1877F2', color: 'white', border: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {socialLoading === 'facebook'
                    ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>}
                Continuar com Facebook
            </button>

            <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', maxWidth: 280 }}>
                Seus dados são isolados e privados por conta.
            </p>
        </div>
    )
}

