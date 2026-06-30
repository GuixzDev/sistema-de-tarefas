/**
 * Testes de propriedade e integração — Rotas de Autenticação
 * Feature: task-management-rbac
 * Properties: 2, 3, 4
 *
 * Nota: /api/auth/registro agora é protegida (requer token de Chefe).
 * Os testes de validação passam token de Chefe válido; o mock de sql
 * intercepta antes de chegar ao banco.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

vi.mock('@/lib/db', () => ({
  default: Object.assign(vi.fn(), { begin: vi.fn() }),
}));

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return { ...actual };
});

import sql from '@/lib/db';
import { signToken } from '@/lib/auth';
import { POST as registro } from '@/app/api/auth/registro/route';
import { POST as login } from '@/app/api/auth/login/route';

// ─── Helpers ─────────────────────────────────────────────────
function chefToken() {
  return signToken({ id: 'chefe-test-id', papel: 'Chefe' });
}

function makeRequest(body: unknown, token?: string): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new Request('http://localhost/api/auth/registro', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function makeLoginRequest(body: unknown): Request {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = 'test-secret-minimo-32-chars-para-teste-unitario';
});

// ─── Sem token → 401 ─────────────────────────────────────────
describe('Registro: requer autenticação de Chefe', () => {
  it('retorna 401 sem token', async () => {
    const req = makeRequest({ email: 'a@b.com', senha: '12345678' });
    const res = await registro(req);
    expect(res.status).toBe(401);
  });

  it('retorna 403 com token de Desenvolvedor', async () => {
    const devToken = signToken({ id: 'dev-id', papel: 'Desenvolvedor' });
    const req = makeRequest({ email: 'a@b.com', senha: '12345678' }, devToken);
    const res = await registro(req);
    expect(res.status).toBe(403);
  });
});

// ─── Property 2: senhas fora de [8,128] → 422 ────────────────
describe('Property 2: senha fora do intervalo [8,128] é rejeitada no registro', () => {
  it('senhas com menos de 8 caracteres retornam 422', async () => {
    const token = chefToken();
    await fc.assert(
      fc.asyncProperty(
        fc.string({ maxLength: 7 }),
        async (senha) => {
          const req = makeRequest({ email: 'test@example.com', senha }, token);
          const res = await registro(req);
          expect(res.status).toBe(422);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('senhas com mais de 128 caracteres retornam 422', async () => {
    const token = chefToken();
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 129, maxLength: 200 }),
        async (senha) => {
          const req = makeRequest({ email: 'test@example.com', senha }, token);
          const res = await registro(req);
          expect(res.status).toBe(422);
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ─── Property 3: e-mails inválidos → 422 ─────────────────────
describe('Property 3: e-mails com formato inválido são rejeitados no registro', () => {
  it('strings sem @ retornam 422', async () => {
    const token = chefToken();
    const invalidos = ['semArroba', 'usuario', '123456', '@', '@dominio', 'user@'];
    for (const email of invalidos) {
      const req = makeRequest({ email, senha: 'senha1234' }, token);
      const res = await registro(req);
      expect(res.status).toBe(422);
    }
  });
});

// ─── Casos específicos do registro ───────────────────────────
describe('Registro: casos específicos (com token de Chefe)', () => {
  it('retorna 409 quando e-mail já está cadastrado', async () => {
    const mockSql = vi.mocked(sql) as unknown as ReturnType<typeof vi.fn>;
    mockSql.mockResolvedValueOnce([{ id: 'existing-id' }]);
    const req = makeRequest({ email: 'existente@example.com', senha: 'senha1234' }, chefToken());
    const res = await registro(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('E-mail já cadastrado');
  });

  it('retorna 201 com id, email e papel para registro válido', async () => {
    const mockSql = vi.mocked(sql) as unknown as ReturnType<typeof vi.fn>;
    mockSql
      .mockResolvedValueOnce([]) // e-mail não existe
      .mockResolvedValueOnce([{ id: 'new-uuid', email: 'novo@example.com', papel: 'Desenvolvedor' }]);
    const req = makeRequest({ email: 'novo@example.com', senha: 'senha1234' }, chefToken());
    const res = await registro(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('email');
    expect(body).toHaveProperty('papel');
    expect(body).not.toHaveProperty('senha_hash');
  });

  it('Chefe pode definir papel ao criar usuário', async () => {
    const mockSql = vi.mocked(sql) as unknown as ReturnType<typeof vi.fn>;
    mockSql
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'uid2', email: 'c@x.com', papel: 'Chefe' }]);
    const req = makeRequest({ email: 'c@x.com', senha: 'senha1234', papel: 'Chefe' }, chefToken());
    const res = await registro(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.papel).toBe('Chefe');
  });
});

// ─── Property 4 & Login ───────────────────────────────────────
describe('Login: casos específicos', () => {
  it('retorna 401 "Credenciais inválidas" para e-mail não cadastrado', async () => {
    const mockSql = vi.mocked(sql) as unknown as ReturnType<typeof vi.fn>;
    mockSql.mockResolvedValueOnce([]);
    const req = makeLoginRequest({ email: 'nao@existe.com', senha: 'qualquersenha' });
    const res = await login(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Credenciais inválidas');
  });

  it('retorna 401 "Credenciais inválidas" para senha incorreta', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('senha-correta', 10);
    const mockSql = vi.mocked(sql) as unknown as ReturnType<typeof vi.fn>;
    mockSql.mockResolvedValueOnce([{ id: 'uid', senha_hash: hash, papel: 'Desenvolvedor' }]);
    const req = makeLoginRequest({ email: 'user@example.com', senha: 'senha-errada' });
    const res = await login(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Credenciais inválidas');
  });

  it('Property 4: login com credenciais válidas retorna JWT com id e papel corretos', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('senha-correta', 10);
    const mockSql = vi.mocked(sql) as unknown as ReturnType<typeof vi.fn>;
    mockSql.mockResolvedValueOnce([{ id: 'uuid-123', senha_hash: hash, papel: 'Chefe' }]);
    const req = makeLoginRequest({ email: 'chefe@example.com', senha: 'senha-correta' });
    const res = await login(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('token');
    const { verifyToken } = await import('@/lib/auth');
    const payload = verifyToken(body.token);
    expect(payload.id).toBe('uuid-123');
    expect(payload.papel).toBe('Chefe');
    expect(payload.exp! - payload.iat!).toBe(8 * 60 * 60);
  });
});
