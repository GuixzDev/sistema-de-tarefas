'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiLogin, apiRegistro } from '@/lib/api-client';
import styles from './page.module.css';

type Tab = 'login' | 'cadastro';

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  function reset() { setError(''); setSuccess(''); }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      const { token } = await apiLogin(email, senha);
      login(token);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  async function handleCadastro(e: React.FormEvent) {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      await apiRegistro(email, senha);
      setSuccess('Conta criada! Agora faça login.');
      setTab('login');
      setSenha('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <h1>⚡ Task Manager</h1>
          <p>Gerencie tarefas com controle de acesso</p>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'login' ? styles.tabActive : ''}`}
            onClick={() => { setTab('login'); reset(); }}
          >
            Entrar
          </button>
          <button
            className={`${styles.tab} ${tab === 'cadastro' ? styles.tabActive : ''}`}
            onClick={() => { setTab('cadastro'); reset(); }}
          >
            Cadastrar
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}
        {success && <div className={styles.success}>{success}</div>}

        {tab === 'login' ? (
          <form className={styles.form} onSubmit={handleLogin}>
            <div className={styles.field}>
              <label className={styles.label}>E-mail</label>
              <input
                type="email" required autoFocus
                placeholder="seu@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Senha</label>
              <input
                type="password" required
                placeholder="••••••••"
                value={senha} onChange={(e) => setSenha(e.target.value)}
              />
            </div>
            <button className={styles.btn} type="submit" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={handleCadastro}>
            <div className={styles.field}>
              <label className={styles.label}>E-mail</label>
              <input
                type="email" required autoFocus
                placeholder="seu@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Senha <span style={{color:'var(--text-muted)',fontWeight:400}}>(mín. 8 caracteres)</span></label>
              <input
                type="password" required minLength={8}
                placeholder="••••••••"
                value={senha} onChange={(e) => setSenha(e.target.value)}
              />
            </div>
            <button className={styles.btn} type="submit" disabled={loading}>
              {loading ? 'Criando conta...' : 'Criar conta'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
