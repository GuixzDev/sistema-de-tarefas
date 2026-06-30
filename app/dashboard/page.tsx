'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  apiListarTarefas, apiCriarTarefa, apiAssumirTarefa,
  apiConcluirTarefa, apiExcluirTarefa,
  type Tarefa,
} from '@/lib/api-client';
import styles from './page.module.css';

type Filter = 'Todos' | 'Disponível' | 'Em Andamento' | 'Concluída';

interface Toast { msg: string; ok: boolean; }

export default function DashboardPage() {
  const { token, user, logout, isLoading } = useAuth();
  const router = useRouter();

  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [filter, setFilter] = useState<Filter>('Todos');
  const [fetching, setFetching] = useState(true);
  const [toast, setToast] = useState<Toast | null>(null);

  // Create form state
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<'Baixa' | 'Média' | 'Alta'>('Alta');
  const [creating, setCreating] = useState(false);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiListarTarefas(token);
      setTarefas(data);
    } catch {
      showToast('Erro ao carregar tarefas', false);
    } finally {
      setFetching(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isLoading && !token) { router.replace('/login'); return; }
    if (token) load();
  }, [token, isLoading, router, load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    try {
      const t = await apiCriarTarefa(token, { titulo, descricao: descricao || undefined, prioridade });
      setTarefas((prev) => [t, ...prev]);
      setTitulo(''); setDescricao('');
      showToast('Tarefa criada!');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro', false);
    } finally {
      setCreating(false);
    }
  }

  async function assumir(id: string) {
    if (!token) return;
    try {
      const updated = await apiAssumirTarefa(token, id);
      setTarefas((prev) => prev.map((t) => t.id === id ? updated : t));
      showToast('Tarefa assumida!');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro', false);
    }
  }

  async function concluir(id: string) {
    if (!token) return;
    try {
      const updated = await apiConcluirTarefa(token, id);
      setTarefas((prev) => prev.map((t) => t.id === id ? updated : t));
      showToast('Tarefa concluída!');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro', false);
    }
  }

  async function excluir(id: string) {
    if (!token) return;
    if (!confirm('Excluir esta tarefa?')) return;
    try {
      await apiExcluirTarefa(token, id);
      setTarefas((prev) => prev.filter((t) => t.id !== id));
      showToast('Tarefa excluída');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Erro', false);
    }
  }

  const filtered = filter === 'Todos' ? tarefas : tarefas.filter((t) => t.status === filter);
  const isChefe = user?.papel === 'Chefe';

  const counts = {
    disp: tarefas.filter((t) => t.status === 'Disponível').length,
    and:  tarefas.filter((t) => t.status === 'Em Andamento').length,
    conc: tarefas.filter((t) => t.status === 'Concluída').length,
  };

  const statusClass: Record<string, string> = {
    'Disponível':  styles.statusDisp,
    'Em Andamento': styles.statusAnd,
    'Concluída':   styles.statusConc,
  };

  const prioClass: Record<string, string> = {
    'Alta':  styles.prioAlta,
    'Média': styles.prioMedia,
    'Baixa': styles.prioBaixa,
  };

  if (isLoading || fetching) {
    return (
      <div className={styles.page}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flex:1, height:'100vh' }}>
          <p style={{ color:'var(--text-muted)' }}>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>⚡ Task Manager</h1>
          <span className={`${styles.badge} ${isChefe ? styles.badgeChefe : styles.badgeDev}`}>
            {user?.papel}
          </span>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.userEmail}>{/* email not in token — just show role */}</span>
          <button className={styles.btnLogout} onClick={() => { logout(); router.push('/login'); }}>
            Sair
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {/* Stats */}
        <div className={styles.stats}>
          {[
            { label: 'Disponíveis', value: counts.disp, color: '#a5b4fc' },
            { label: 'Em Andamento', value: counts.and,  color: '#fcd34d' },
            { label: 'Concluídas',   value: counts.conc, color: '#86efac' },
            { label: 'Total',        value: tarefas.length, color: 'var(--text)' },
          ].map((s) => (
            <div className={styles.stat} key={s.label}>
              <div className={styles.statLabel}>{s.label}</div>
              <div className={styles.statValue} style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Create form (Chefe only) */}
        {isChefe && (
          <form className={styles.createForm} onSubmit={handleCreate}>
            <div className={styles.createField}>
              <label>Título</label>
              <input
                required maxLength={100}
                placeholder="Título da tarefa"
                value={titulo} onChange={(e) => setTitulo(e.target.value)}
              />
            </div>
            <div className={styles.createField}>
              <label>Descrição</label>
              <input
                placeholder="Opcional"
                value={descricao} onChange={(e) => setDescricao(e.target.value)}
              />
            </div>
            <div className={styles.createField}>
              <label>Prioridade</label>
              <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as 'Baixa' | 'Média' | 'Alta')}>
                <option>Alta</option>
                <option>Média</option>
                <option>Baixa</option>
              </select>
            </div>
            <button className={styles.btnCreate} type="submit" disabled={creating}>
              {creating ? 'Criando...' : '+ Criar tarefa'}
            </button>
          </form>
        )}

        {/* Section header + filters */}
        <div className={styles.sectionHeader}>
          <h2>Tarefas {filter !== 'Todos' ? `— ${filter}` : ''} ({filtered.length})</h2>
          <div className={styles.filterBar}>
            {(['Todos', 'Disponível', 'Em Andamento', 'Concluída'] as Filter[]).map((f) => (
              <button
                key={f}
                className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Task grid */}
        <div className={styles.grid}>
          {filtered.length === 0 && (
            <div className={styles.empty}>
              {filter === 'Todos' ? 'Nenhuma tarefa ainda.' : `Nenhuma tarefa com status "${filter}".`}
            </div>
          )}

          {filtered.map((tarefa) => (
            <div key={tarefa.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>{tarefa.titulo}</span>
              </div>

              {tarefa.descricao && (
                <p className={styles.cardDesc}>{tarefa.descricao}</p>
              )}

              <div className={styles.cardMeta}>
                <span className={`${styles.chip} ${statusClass[tarefa.status]}`}>
                  {tarefa.status}
                </span>
                <span className={`${styles.chip} ${prioClass[tarefa.prioridade]}`}>
                  {tarefa.prioridade}
                </span>
              </div>

              <div className={styles.cardActions}>
                {/* Desenvolvedor: assume se Disponível e não tem outra */}
                {!isChefe && tarefa.status === 'Disponível' && (
                  <button className={`${styles.btnAction} ${styles.btnAssume}`}
                    onClick={() => assumir(tarefa.id)}>
                    Assumir
                  </button>
                )}

                {/* Desenvolvedor: conclui se for responsável */}
                {!isChefe && tarefa.status === 'Em Andamento' && tarefa.responsavel_id === user?.id && (
                  <button className={`${styles.btnAction} ${styles.btnComplete}`}
                    onClick={() => concluir(tarefa.id)}>
                    Concluir
                  </button>
                )}

                {/* Chefe: exclui se Disponível */}
                {isChefe && tarefa.status === 'Disponível' && (
                  <button className={`${styles.btnAction} ${styles.btnDelete}`}
                    onClick={() => excluir(tarefa.id)}>
                    Excluir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${toast.ok ? styles.toastOk : styles.toastErr}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
