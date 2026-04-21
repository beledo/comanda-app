import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await signIn(email, password)

    if (authError) {
      setError('Credenciales inválidas')
      setLoading(false)
      return
    }

    const role = data.user.user_metadata?.role || 'waiter'
    const ROLES = { waiter: '/waiter', kitchen: '/kitchen', bar: '/bar', admin: '/admin', manager: '/admin', cashier: '/admin', superadmin: '/admin' }
    
    navigate(ROLES[role] || '/waiter', { replace: true })
    setLoading(false)
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <div style={s.logoCircle}>🍽️</div>
          <h1 style={s.title}>Bienvenido</h1>
          <p style={s.sub}>Inicia sesión para comenzar tu turno</p>
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          <input
            type="email" required placeholder="Correo electrónico"
            value={email} onChange={e => setEmail(e.target.value)}
            style={s.input}
          />
          <input
            type="password" required placeholder="Contraseña"
            value={password} onChange={e => setPassword(e.target.value)}
            style={s.input}
          />
          
          {error && <div style={s.error}>{error}</div>}

          <button type="submit" disabled={loading} style={s.button}>
            {loading ? 'Accediendo...' : 'Entrar al sistema'}
          </button>
        </form>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'radial-gradient(circle at top right, #1e293b, #0f172a)',
    padding: '20px', fontFamily: '"Inter", sans-serif'
  },
  card: {
    width: '100%', maxWidth: '400px', padding: '40px',
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
  },
  header: { textAlign: 'center', marginBottom: '32px' },
  logoCircle: { 
    width: '60px', height: '60px', borderRadius: '50%', background: '#3b82f6',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '24px', margin: '0 auto 16px', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
  },
  title: { color: '#fff', fontSize: '24px', fontWeight: '700', margin: '0' },
  sub: { color: '#94a3b8', fontSize: '14px', marginTop: '8px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  input: {
    background: 'rgba(0,0,0,0.2)', border: '1px solid #334155', borderRadius: '12px',
    padding: '14px', color: '#fff', fontSize: '15px', transition: 'border 0.2s'
  },
  button: {
    background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '12px',
    padding: '14px', fontSize: '16px', fontWeight: '600', cursor: 'pointer',
    marginTop: '8px', transition: 'background 0.2s'
  },
  error: { color: '#fb7185', fontSize: '13px', textAlign: 'center', background: 'rgba(251, 113, 133, 0.1)', padding: '8px', borderRadius: '8px' }
}