'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  apiListarTarefas, apiCriarTarefa, apiAssumirTarefa,
  apiConcluirTarefa, apiExcluirTarefa,
  apiListarUsuarios, apiRegistroAdmin, apiAlterarPapel,
  type Tarefa, type Usuario,
} from '@/lib/api-client';
import styles from './page.module.css';

type Filter = 'Todos' | 'Disponível' | 'Em Andamento' | 'Concluída';
type Tab = 'tarefas' | 'usuarios';
interface Toast { msg: string; ok: boolean; }

// ─── Formata data para exibição amigável ─────────────────────
function fmtData(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function DashboardPage() {
  const { token, user, logout, isLoading } = useAuth();
  const router = useRouter();
  const isChefe = user?.papel === 'Chefe';

  // ── Tarefas ──────────────────────────────────────────────
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [filter, setFilter] = useState<Filter>('Todos');
  const [fetching, setFetching] = useState(true);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<'Baixa' | 'Média' | 'Alta'>('Alta');
  const [creating, setCreating] = useState(false);

  // ── Usuários (Chefe) ─────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('tarefas');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [uEmail, setUEmail] = useState('');
  const [uSenha, setUSenha] = useState('');
  const [uPapel, setUPapel] = useState<'Chefe' | 'Desenvolvedor'>('Desenvolvedor');
  const [addingUser, setAddingUser] = useState(false);

  // ── Toast ────────────────────────────────────────────────
  const [toast, setToast] = useState<Toast | null>(null);
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Carrega tarefas ──────────────────────────────────────
  const loadTarefas = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiListarTarefas(token);
      setTarefas(data);
    } catch { showToast('Erro ao carregar tarefas', false); }
    finally { setFetching(false); }
  }, [token]);

  // ── Carrega usuários (aba Chefe) ─────────────────────────
  const loadUsuarios = useCallback(async () => {
    if (!token || !isChefe) return;
    setLoadingUsers(true);
    try {
      const data = await apiListarUsuarios(token);
      setUsuarios(data);
    } catch { showToast('Erro ao carregar usuários', false); }
    finally { setLoadingUsers(false); }
  }, [token, isChefe]);

  useEffect(() => {
    if (!isLoading && !token) { router.replace('/login'); return; }
    if (token) loadTarefas();
  }, [token, isLoading, router, loadTarefas]);

  useEffect(() => {
    if (activeTab === 'usuarios') loadUsuarios();
  }, [activeTab, loadUsuarios]);

  // ── Ações de tarefas ─────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    try {
      const t = await apiCriarTarefa(token, { titulo, descricao: descricao || undefined, prioridade });
      setTarefas((p) => [t, ...p]);
      setTitulo(''); setDescricao('');
      showToast('Tarefa criada!');
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Erro', false); }
    finally { setCreating(false); }
  }

  async function assumir(id: string) {
    if (!token) return;
    try {
      const u = await apiAssumirTarefa(token, id);
      setTarefas((p) => p.map((t) => t.id === id ? u : t));
      showToast('Tarefa assumida!');
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Erro', false); }
  }

  async function concluir(id: string) {
    if (!token) return;
    try {
      const u = await apiConcluirTarefa(token, id);
      setTarefas((p) => p.map((t) => t.id === id ? u : t));
      showToast('Tarefa concluída!');
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Erro', false); }
  }

  async function excluir(id: string) {
    if (!token || !confirm('Excluir esta tarefa?')) return;
    try {
      await apiExcluirTarefa(token, id);
      setTarefas((p) => p.filter((t) => t.id !== id));
      showToast('Tarefa excluída');
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Erro', false); }
  }

  // ── Adicionar usuário ────────────────────────────────────
  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setAddingUser(true);
    try {
      const novo = await apiRegistroAdmin(token, uEmail, uSenha, uPapel);
      setUsuarios((p) => [...p, { id: novo.id, email: novo.email, papel: novo.papel as 'Chefe' | 'Desenvolvedor' }]);
      setUEmail(''); setUSenha('');
      showToast(`Usuário ${novo.email} criado!`);
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Erro', false); }
    finally { setAddingUser(false); }
  }

  // ── Alterar papel de usuário ─────────────────────────────
  async function handleChangePapel(userId: string, novoPapel: 'Chefe' | 'Desenvolvedor') {
    if (!token) return;
    try {
      const updated = await apiAlterarPapel(token, userId, novoPapel);
      setUsuarios((p) => p.map((u) => u.id === userId ? { ...u, papel: updated.papel } : u));
      showToast('Papel atualizado!');
    } catch (err: unknown) { showToast(err instanceof Error ? err.message : 'Erro', false); }
  }

  // ── Computed ─────────────────────────────────────────────
  const filtered = filter === 'Todos' ? tarefas : tarefas.filter((t) => t.status === filter);
  const counts = {
    disp: tarefas.filter((t) => t.status === 'Disponível').length,
    and:  tarefas.filter((t) => t.status === 'Em Andamento').length,
    conc: tarefas.filter((t) => t.status === 'Concluída').length,
  };
  const statusClass: Record<string, string> = {
    'Disponível': styles.statusDisp,
    'Em Andamento': styles.statusAnd,
    'Concluída': styles.statusConc,
  };
  const prioClass: Record<string, string> = {
    'Alta': styles.prioAlta, 'Média': styles.prioMedia, 'Baixa': styles.prioBaixa,
  };

  if (isLoading || fetching) {
    return (
      <div className={styles.page}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <p style={{ color: 'var(--text-muted)' }}>Carregando...</p>
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
          <button className={styles.btnLogout} onClick={() => { logout(); router.push('/login'); }}>
            Sair
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {/* Stats */}
        <div className={styles.stats}>
          {[
            { label: 'Disponíveis',  value: counts.disp, color: '#a5b4fc' },
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

        {/* Nav tabs — Chefe vê aba de usuários */}
        {isChefe && (
          <div className={styles.navTabs}>
            {(['tarefas', 'usuarios'] as Tab[]).map((t) => (
              <button key={t}
                className={`${styles.navTab} ${activeTab === t ? styles.navTabActive : ''}`}
                onClick={() => setActiveTab(t)}
              >
                {t === 'tarefas' ? '📋 Tarefas' : '👥 Gerenciar Usuários'}
              </button>
            ))}
          </div>
        )}

        {/* ── ABA TAREFAS ─────────────────────────────────── */}
        {activeTab === 'tarefas' && (
          <>
            {/* Formulário de criação (Chefe) */}
            {isChefe && (
              <form className={styles.createForm} onSubmit={handleCreate}>
                <div className={styles.createField}>
                  <label>Título</label>
                  <input required maxLength={100} placeholder="Título da tarefa"
                    value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                </div>
                <div className={styles.createField}>
                  <label>Descrição</label>
                  <input placeholder="Opcional"
                    value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                </div>
                <div className={styles.createField}>
                  <label>Prioridade</label>
                  <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as 'Baixa' | 'Média' | 'Alta')}>
                    <option>Alta</option><option>Média</option><option>Baixa</option>
                  </select>
                </div>
                <button className={styles.btnCreate} type="submit" disabled={creating}>
                  {creating ? 'Criando...' : '+ Criar tarefa'}
                </button>
              </form>
            )}

            {/* Filtros */}
            <div className={styles.sectionHeader}>
              <h2>Tarefas {filter !== 'Todos' ? `— ${filter}` : ''} ({filtered.length})</h2>
              <div className={styles.filterBar}>
                {(['Todos', 'Disponível', 'Em Andamento', 'Concluída'] as Filter[]).map((f) => (
                  <button key={f}
                    className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ''}`}
                    onClick={() => setFilter(f)}>{f}</button>
                ))}
              </div>
            </div>

            {/* Grid de cards */}
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

                  {tarefa.descricao && <p className={styles.cardDesc}>{tarefa.descricao}</p>}

                  <div className={styles.cardMeta}>
                    <span className={`${styles.chip} ${statusClass[tarefa.status]}`}>{tarefa.status}</span>
                    <span className={`${styles.chip} ${prioClass[tarefa.prioridade]}`}>{tarefa.prioridade}</span>
                  </div>

                  {/* Rodapé com responsável e data de assunção */}
                  {tarefa.responsavel_email && (
                    <div className={styles.cardFooter}>
                      👤 <span>{tarefa.responsavel_email}</span>
                      {tarefa.assumida_em && (
                        <> · {fmtData(tarefa.assumida_em)}</>
                      )}
                    </div>
                  )}

                  <div className={styles.cardActions}>
                    {!isChefe && tarefa.status === 'Disponível' && (
                      <button className={`${styles.btnAction} ${styles.btnAssume}`}
                        onClick={() => assumir(tarefa.id)}>Assumir</button>
                    )}
                    {!isChefe && tarefa.status === 'Em Andamento' && tarefa.responsavel_id === user?.id && (
                      <button className={`${styles.btnAction} ${styles.btnComplete}`}
                        onClick={() => concluir(tarefa.id)}>Concluir</button>
                    )}
                    {isChefe && tarefa.status === 'Disponível' && (
                      <button className={`${styles.btnAction} ${styles.btnDelete}`}
                        onClick={() => excluir(tarefa.id)}>Excluir</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── ABA USUÁRIOS (Chefe) ────────────────────────── */}
        {activeTab === 'usuarios' && isChefe && (
          <div className={styles.usersPanel}>
            {/* Formulário de novo usuário */}
            <div className={styles.addUserForm}>
              <h3>➕ Adicionar novo usuário</h3>
              <form onSubmit={handleAddUser}>
                <div className={styles.addUserGrid}>
                  <div className={styles.addUserField}>
                    <label>E-mail</label>
                    <input type="email" required placeholder="usuario@empresa.com"
                      value={uEmail} onChange={(e) => setUEmail(e.target.value)} />
                  </div>
                  <div className={styles.addUserField}>
                    <label>Senha <span style={{color:'var(--text-muted)',fontWeight:400}}>(mín. 8 chars)</span></label>
                    <input type="password" required minLength={8} placeholder="••••••••"
                      value={uSenha} onChange={(e) => setUSenha(e.target.value)} />
                  </div>
                  <div className={styles.addUserField}>
                    <label>Papel</label>
                    <select value={uPapel} onChange={(e) => setUPapel(e.target.value as 'Chefe' | 'Desenvolvedor')}>
                      <option value="Desenvolvedor">Desenvolvedor</option>
                      <option value="Chefe">Chefe</option>
                    </select>
                  </div>
                  <button className={styles.btnAddUser} type="submit" disabled={addingUser}>
                    {addingUser ? 'Criando...' : 'Criar'}
                  </button>
                </div>
              </form>
            </div>

            {/* Tabela de usuários */}
            <div className={styles.usersTable}>
              <h3>Usuários cadastrados ({usuarios.length})</h3>
              <div className={styles.tableWrap}>
                {loadingUsers ? (
                  <p style={{ padding: '1rem 1.25rem', color: 'var(--text-muted)' }}>Carregando...</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>E-mail</th>
                        <th>Papel</th>
                        <th>Alterar papel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuarios.map((u) => (
                        <tr key={u.id}>
                          <td>{u.email}</td>
                          <td>
                            <span className={`${styles.chip} ${u.papel === 'Chefe' ? styles.badgeChefe : styles.badgeDev}`}>
                              {u.papel}
                            </span>
                          </td>
                          <td>
                            {u.id !== user?.id ? (
                              <select
                                value={u.papel}
                                onChange={(e) => handleChangePapel(u.id, e.target.value as 'Chefe' | 'Desenvolvedor')}
                                style={{ minWidth: 'unset', width: '150px', padding: '0.35rem 0.6rem' }}
                              >
                                <option value="Desenvolvedor">Desenvolvedor</option>
                                <option value="Chefe">Chefe</option>
                              </select>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Você</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {usuarios.length === 0 && (
                        <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          Nenhum usuário encontrado.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}
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
