/**
 * lib/api-client.ts
 * Cliente HTTP para consumo das API Routes do sistema Task Management RBAC.
 * Usado exclusivamente pelo frontend (Client Components).
 */

export interface ApiError {
  error: string;
  details?: { campo: string; mensagem: string }[];
}

export interface Usuario {
  id: string;
  email: string;
  papel: 'Chefe' | 'Desenvolvedor';
}

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: 'Baixa' | 'Média' | 'Alta';
  status: 'Disponível' | 'Em Andamento' | 'Concluída';
  responsavel_id: string | null;
  responsavel_email?: string | null;
  assumida_em?: string | null;
  criado_em: string;
  atualizado_em: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    const err = data as ApiError;
    const message =
      err.details?.map((d) => d.mensagem).join(', ') ?? err.error ?? 'Erro desconhecido';
    throw new Error(message);
  }

  return data as T;
}

// ─── Auth ────────────────────────────────────────────────────

export async function apiRegistroAdmin(
  token: string,
  email: string,
  senha: string,
  papel: 'Chefe' | 'Desenvolvedor'
) {
  return request<{ id: string; email: string; papel: string }>('/api/auth/registro', {
    method: 'POST',
    body: JSON.stringify({ email, senha, papel }),
  }, token);
}

export async function apiLogin(email: string, senha: string) {
  return request<{ token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  });
}

// ─── Tarefas ─────────────────────────────────────────────────

export async function apiListarTarefas(token: string) {
  return request<Tarefa[]>('/api/tarefas', { method: 'GET' }, token);
}

export async function apiCriarTarefa(
  token: string,
  data: { titulo: string; descricao?: string; prioridade: string }
) {
  return request<Tarefa>('/api/tarefas', { method: 'POST', body: JSON.stringify(data) }, token);
}

export async function apiAssumirTarefa(token: string, id: string) {
  return request<Tarefa>(`/api/tarefas/${id}/assumir`, { method: 'POST' }, token);
}

export async function apiConcluirTarefa(token: string, id: string) {
  return request<Tarefa>(`/api/tarefas/${id}/concluir`, { method: 'POST' }, token);
}

export async function apiExcluirTarefa(token: string, id: string) {
  return request<{ message: string }>(`/api/tarefas/${id}`, { method: 'DELETE' }, token);
}

// ─── Usuários ────────────────────────────────────────────────

export async function apiListarUsuarios(token: string) {
  return request<Usuario[]>('/api/usuarios', { method: 'GET' }, token);
}

export async function apiAlterarPapel(
  token: string,
  userId: string,
  papel: 'Chefe' | 'Desenvolvedor'
) {
  return request<Usuario>(`/api/usuarios/${userId}/papel`, {
    method: 'PATCH',
    body: JSON.stringify({ papel }),
  }, token);
}
