/**
 * Testes unitários para lib/middleware.ts
 * Cobre: requireAuth, requirePapel
 * Feature: task-management-rbac
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { requireAuth, requirePapel } from '@/lib/middleware';
import { signToken } from '@/lib/auth';
import type { JWTPayload } from '@/types';

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-minimo-32-chars-para-teste-unitario';
});

afterEach(() => {
  delete process.env.JWT_SECRET;
});

// Helper para criar um Request com Authorization header
function makeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers['Authorization'] = authHeader;
  }
  return new Request('http://localhost/api/test', { headers });
}

// Helper para ler JSON de uma Response
async function getResponseJson(res: Response): Promise<{ error: string }> {
  return res.json();
}

describe('requireAuth', () => {
  it('retorna JWTPayload para token válido', () => {
    const token = signToken({ id: 'user-1', papel: 'Chefe' });
    const req = makeRequest(`Bearer ${token}`);
    const result = requireAuth(req);
    expect(result).not.toBeInstanceOf(Response);
    const payload = result as JWTPayload;
    expect(payload.id).toBe('user-1');
    expect(payload.papel).toBe('Chefe');
  });

  it('retorna Response 401 quando header Authorization está ausente', async () => {
    const req = makeRequest();
    const result = requireAuth(req);
    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(401);
    const body = await getResponseJson(res);
    expect(body.error).toBe('Token não fornecido');
  });

  it('retorna Response 401 com mensagem "Token expirado" para token expirado', async () => {
    const jwt = await import('jsonwebtoken');
    const expired = jwt.sign(
      { id: 'id-1', papel: 'Chefe' },
      process.env.JWT_SECRET!,
      { expiresIn: -1 }
    );
    const req = makeRequest(`Bearer ${expired}`);
    const result = requireAuth(req);
    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(401);
    const body = await getResponseJson(res);
    expect(body.error).toBe('Token expirado');
  });

  it('retorna Response 401 com mensagem "Token inválido" para token malformado', async () => {
    const req = makeRequest('Bearer token-totalmente-invalido');
    const result = requireAuth(req);
    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(401);
    const body = await getResponseJson(res);
    expect(body.error).toBe('Token inválido');
  });
});

describe('requirePapel', () => {
  const payloadChefe: JWTPayload = { id: 'u1', papel: 'Chefe' };
  const payloadDev: JWTPayload = { id: 'u2', papel: 'Desenvolvedor' };
  const payloadDesconhecido = { id: 'u3', papel: 'Admin' } as unknown as JWTPayload;

  it('retorna null quando papel está na lista permitida (Chefe → [Chefe])', () => {
    expect(requirePapel(payloadChefe, ['Chefe'])).toBeNull();
  });

  it('retorna null quando papel está na lista permitida (Desenvolvedor → [Desenvolvedor])', () => {
    expect(requirePapel(payloadDev, ['Desenvolvedor'])).toBeNull();
  });

  it('retorna null quando lista contém ambos os papéis', () => {
    expect(requirePapel(payloadChefe, ['Chefe', 'Desenvolvedor'])).toBeNull();
    expect(requirePapel(payloadDev, ['Chefe', 'Desenvolvedor'])).toBeNull();
  });

  it('retorna Response 403 quando Desenvolvedor tenta acessar rota de Chefe', async () => {
    const result = requirePapel(payloadDev, ['Chefe']);
    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(403);
    const body = await getResponseJson(res);
    expect(body.error).toBe('Acesso negado');
  });

  it('retorna Response 403 quando Chefe tenta acessar rota de Desenvolvedor', async () => {
    const result = requirePapel(payloadChefe, ['Desenvolvedor']);
    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(403);
  });

  it('retorna Response 403 para papel desconhecido (adulteração de token)', async () => {
    const result = requirePapel(payloadDesconhecido, ['Chefe']);
    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(403);
    const body = await getResponseJson(res);
    expect(body.error).toBe('Acesso negado');
  });
});
