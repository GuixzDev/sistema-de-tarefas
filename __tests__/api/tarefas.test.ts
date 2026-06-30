/**
 * Testes de propriedade e integração — Rotas de Tarefas e Usuários
 * Feature: task-management-rbac
 * Properties: 6, 7, 8, 9, 10, 11, 12, 13, 14, 15
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// ─── Mocks ───────────────────────────────────────────────────
vi.mock('@/lib/db', () => {
  const mockFn = vi.fn();
  (mockFn as unknown as { begin: ReturnType<typeof vi.fn> }).begin = vi.fn();
  return { default: mockFn };
});

import sql from '@/lib/db';
import { signToken } from '@/lib/auth';
import { GET as getTarefas, POST as postTarefas } from '@/app/api/tarefas/route';
import { PATCH as patchTarefa, DELETE as deleteTarefa } from '@/app/api/tarefas/[id]/route';
import { POST as assumirTarefa } from '@/app/api/tarefas/[id]/assumir/route';
import { POST as concluirTarefa } from '@/app/api/tarefas/[id]/concluir/route';
import { PATCH as alterarPapel } from '@/app/api/usuarios/[id]/papel/route';


// ─── Helpers ─────────────────────────────────────────────────
function makeReq(method: string, body?: unknown, token?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new Request('http://localhost/api/test', {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function chefToken(): string {
  return signToken({ id: 'chefe-id', papel: 'Chefe' });
}

function devToken(id = 'dev-id'): string {
  return signToken({ id, papel: 'Desenvolvedor' });
}

const TAREFA_BASE = {
  id: 'tarefa-uuid',
  titulo: 'Tarefa teste',
  descricao: null,
  prioridade: 'Alta',
  status: 'Disponível',
  responsavel_id: null,
  criado_em: new Date().toISOString(),
  atualizado_em: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret-minimo-32-chars-para-testes-api';
});


// ─── Property 6: Desenvolvedor não pode executar operações de Chefe ──
describe('Property 6: Desenvolvedor recebe 403 em rotas exclusivas de Chefe', () => {
  it('POST /api/tarefas com token de Desenvolvedor → 403', async () => {
    const req = makeReq('POST', { titulo: 'T', prioridade: 'Alta' }, devToken());
    const res = await postTarefas(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Acesso negado');
  });

  it('DELETE /api/tarefas/[id] com token de Desenvolvedor → 403', async () => {
    const req = makeReq('DELETE', undefined, devToken());
    const res = await deleteTarefa(req, { params: { id: 'some-id' } });
    expect(res.status).toBe(403);
  });

  it('PATCH /api/tarefas/[id] com token de Desenvolvedor → 403', async () => {
    const req = makeReq('PATCH', { titulo: 'Novo' }, devToken());
    const res = await patchTarefa(req, { params: { id: 'some-id' } });
    expect(res.status).toBe(403);
  });

  it('PATCH /api/usuarios/[id]/papel com token de Desenvolvedor → 403', async () => {
    const req = makeReq('PATCH', { papel: 'Chefe' }, devToken());
    const res = await alterarPapel(req, { params: { id: 'outro-id' } });
    expect(res.status).toBe(403);
  });
});


// ─── Property 7: Criação de tarefa válida → status Disponível ────────
describe('Property 7: Chefe cria tarefa válida → 201, status Disponível', () => {
  it('títulos entre 1-100 chars com prioridade válida retornam 201', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.constantFrom('Baixa', 'Média', 'Alta'),
        async (titulo, prioridade) => {
          const mockSql = vi.mocked(sql) as unknown as ReturnType<typeof vi.fn>;
          mockSql.mockResolvedValueOnce([{ ...TAREFA_BASE, titulo, prioridade }]);
          const req = makeReq('POST', { titulo, prioridade }, chefToken());
          const res = await postTarefas(req);
          expect(res.status).toBe(201);
          const body = await res.json();
          expect(body.status).toBe('Disponível');
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ─── Property 8: Títulos inválidos → 422 ─────────────────────────────
describe('Property 8: títulos inválidos são rejeitados na criação', () => {
  it('título vazio retorna 422', async () => {
    const req = makeReq('POST', { titulo: '', prioridade: 'Alta' }, chefToken());
    const res = await postTarefas(req);
    expect(res.status).toBe(422);
  });

  it('títulos com >100 caracteres retornam 422', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 101, maxLength: 200 }),
        async (titulo) => {
          const req = makeReq('POST', { titulo, prioridade: 'Alta' }, chefToken());
          const res = await postTarefas(req);
          expect(res.status).toBe(422);
        }
      ),
      { numRuns: 30 }
    );
  });
});


// ─── Property 9: Atualização parcial preserva campos não fornecidos ──
describe('Property 9: PATCH parcial retorna apenas campos atualizados', () => {
  it('PATCH com apenas titulo preserva prioridade original', async () => {
    const mockSql = vi.mocked(sql) as unknown as ReturnType<typeof vi.fn>;
    mockSql
      .mockResolvedValueOnce([{ id: 'tid' }]) // SELECT existe
      .mockResolvedValueOnce([{ ...TAREFA_BASE, titulo: 'Título atualizado', prioridade: 'Alta' }]);
    const req = makeReq('PATCH', { titulo: 'Título atualizado' }, chefToken());
    const res = await patchTarefa(req, { params: { id: 'tid' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.prioridade).toBe('Alta'); // preservado
  });
});

// ─── Properties 10 & 11: Listagem filtrada por papel ─────────────────
describe('Properties 10 & 11: listagem filtrada por papel', () => {
  it('Property 10: Desenvolvedor recebe 200 (filtragem ocorre na query SQL)', async () => {
    const mockSql = vi.mocked(sql) as unknown as ReturnType<typeof vi.fn>;
    mockSql.mockResolvedValueOnce([{ ...TAREFA_BASE, status: 'Disponível' }]);
    const req = makeReq('GET', undefined, devToken());
    const res = await getTarefas(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('Property 11: Chefe recebe 200 com todas as tarefas', async () => {
    const mockSql = vi.mocked(sql) as unknown as ReturnType<typeof vi.fn>;
    mockSql.mockResolvedValueOnce([
      { ...TAREFA_BASE, status: 'Disponível' },
      { ...TAREFA_BASE, id: 'tid2', status: 'Em Andamento' },
      { ...TAREFA_BASE, id: 'tid3', status: 'Concluída' },
    ]);
    const req = makeReq('GET', undefined, chefToken());
    const res = await getTarefas(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(3);
  });

  it('listagem sem token retorna 401', async () => {
    const req = makeReq('GET');
    const res = await getTarefas(req);
    expect(res.status).toBe(401);
  });
});


// ─── Property 12: Assumir tarefa Disponível → Em Andamento ───────────
describe('Property 12: assumir tarefa Disponível muda status e registra responsável', () => {
  it('Desenvolvedor assume tarefa Disponível → 200 com status Em Andamento', async () => {
    const mockBegin = vi.mocked((sql as unknown as { begin: ReturnType<typeof vi.fn> }).begin);
    mockBegin.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = vi.fn()
        .mockResolvedValueOnce([{ id: 'tid', status: 'Disponível' }]) // SELECT FOR UPDATE
        .mockResolvedValueOnce([]) // sem tarefa em andamento
        .mockResolvedValueOnce([{ ...TAREFA_BASE, status: 'Em Andamento', responsavel_id: 'dev-id' }]);
      return cb(tx);
    });
    const req = makeReq('POST', undefined, devToken('dev-id'));
    const res = await assumirTarefa(req, { params: { id: 'tid' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('Em Andamento');
    expect(body.responsavel_id).toBe('dev-id');
  });

  it('tarefa inexistente → 404', async () => {
    const mockBegin = vi.mocked((sql as unknown as { begin: ReturnType<typeof vi.fn> }).begin);
    mockBegin.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = vi.fn().mockResolvedValueOnce([]); // tarefa não encontrada
      return cb(tx);
    });
    const req = makeReq('POST', undefined, devToken());
    const res = await assumirTarefa(req, { params: { id: 'inexistente' } });
    expect(res.status).toBe(404);
  });

  it('tarefa não Disponível → 409', async () => {
    const mockBegin = vi.mocked((sql as unknown as { begin: ReturnType<typeof vi.fn> }).begin);
    mockBegin.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = vi.fn().mockResolvedValueOnce([{ id: 'tid', status: 'Em Andamento' }]);
      return cb(tx);
    });
    const req = makeReq('POST', undefined, devToken());
    const res = await assumirTarefa(req, { params: { id: 'tid' } });
    expect(res.status).toBe(409);
  });
});


// ─── Property 13: Desenvolvedor com tarefa em andamento não pode assumir outra ──
describe('Property 13: Desenvolvedor com tarefa Em Andamento não pode assumir outra', () => {
  it('retorna 409 "Usuário já possui uma tarefa em andamento"', async () => {
    const mockBegin = vi.mocked((sql as unknown as { begin: ReturnType<typeof vi.fn> }).begin);
    mockBegin.mockImplementationOnce(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = vi.fn()
        .mockResolvedValueOnce([{ id: 'tid', status: 'Disponível' }]) // tarefa existe e disponível
        .mockResolvedValueOnce([{ id: 'outra-tid' }]); // já tem tarefa em andamento
      return cb(tx);
    });
    const req = makeReq('POST', undefined, devToken());
    const res = await assumirTarefa(req, { params: { id: 'tid' } });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('em andamento');
  });
});

// ─── Property 14: Concluir tarefa própria Em Andamento → Concluída ───
describe('Property 14: Desenvolvedor conclui sua própria tarefa Em Andamento', () => {
  it('retorna 200 com status Concluída', async () => {
    const mockSql = vi.mocked(sql) as unknown as ReturnType<typeof vi.fn>;
    mockSql
      .mockResolvedValueOnce([{ id: 'tid', status: 'Em Andamento', responsavel_id: 'dev-id' }])
      .mockResolvedValueOnce([{ ...TAREFA_BASE, status: 'Concluída', responsavel_id: 'dev-id' }]);
    const req = makeReq('POST', undefined, devToken('dev-id'));
    const res = await concluirTarefa(req, { params: { id: 'tid' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('Concluída');
  });

  it('Desenvolvedor não-responsável recebe 403', async () => {
    const mockSql = vi.mocked(sql) as unknown as ReturnType<typeof vi.fn>;
    mockSql.mockResolvedValueOnce([{ id: 'tid', status: 'Em Andamento', responsavel_id: 'outro-dev' }]);
    const req = makeReq('POST', undefined, devToken('dev-id'));
    const res = await concluirTarefa(req, { params: { id: 'tid' } });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Acesso negado');
  });

  it('tarefa não Em Andamento → 409', async () => {
    const mockSql = vi.mocked(sql) as unknown as ReturnType<typeof vi.fn>;
    mockSql.mockResolvedValueOnce([{ id: 'tid', status: 'Disponível', responsavel_id: 'dev-id' }]);
    const req = makeReq('POST', undefined, devToken('dev-id'));
    const res = await concluirTarefa(req, { params: { id: 'tid' } });
    expect(res.status).toBe(409);
  });
});


// ─── Property 15: Chefe altera papel → 200 com campos corretos ───────
describe('Property 15: Chefe altera papel de outro usuário', () => {
  it('retorna 200 com id, email e papel atualizados', async () => {
    const mockSql = vi.mocked(sql) as unknown as ReturnType<typeof vi.fn>;
    mockSql.mockResolvedValueOnce([{ id: 'alvo-id', email: 'alvo@x.com', papel: 'Chefe' }]);
    const req = makeReq('PATCH', { papel: 'Chefe' }, chefToken());
    const res = await alterarPapel(req, { params: { id: 'alvo-id' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('email');
    expect(body).toHaveProperty('papel');
    expect(body).not.toHaveProperty('senha_hash');
  });

  it('Chefe tentando alterar o próprio papel → 403', async () => {
    const req = makeReq('PATCH', { papel: 'Desenvolvedor' }, chefToken());
    const res = await alterarPapel(req, { params: { id: 'chefe-id' } });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('próprio papel');
  });

  it('usuário alvo não encontrado → 404', async () => {
    const mockSql = vi.mocked(sql) as unknown as ReturnType<typeof vi.fn>;
    mockSql.mockResolvedValueOnce([]); // UPDATE não afetou nenhuma linha
    const req = makeReq('PATCH', { papel: 'Desenvolvedor' }, chefToken());
    const res = await alterarPapel(req, { params: { id: 'inexistente-id' } });
    expect(res.status).toBe(404);
  });

  it('papel inválido → 422', async () => {
    const req = makeReq('PATCH', { papel: 'SuperAdmin' }, chefToken());
    const res = await alterarPapel(req, { params: { id: 'alvo-id' } });
    expect(res.status).toBe(422);
  });
});

// ─── DELETE: Chefe exclui tarefa Em Andamento → 409 ──────────────────
describe('DELETE: Chefe tenta excluir tarefa não-Disponível', () => {
  it('tarefa Em Andamento → 409', async () => {
    const mockSql = vi.mocked(sql) as unknown as ReturnType<typeof vi.fn>;
    mockSql.mockResolvedValueOnce([{ id: 'tid', status: 'Em Andamento' }]);
    const req = makeReq('DELETE', undefined, chefToken());
    const res = await deleteTarefa(req, { params: { id: 'tid' } });
    expect(res.status).toBe(409);
  });

  it('tarefa inexistente → 404', async () => {
    const mockSql = vi.mocked(sql) as unknown as ReturnType<typeof vi.fn>;
    mockSql.mockResolvedValueOnce([]);
    const req = makeReq('DELETE', undefined, chefToken());
    const res = await deleteTarefa(req, { params: { id: 'nao-existe' } });
    expect(res.status).toBe(404);
  });
});
