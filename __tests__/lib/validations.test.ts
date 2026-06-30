/**
 * Testes unitários para lib/validations.ts
 * Cobre: todos os schemas Zod e o helper parseBody
 * Feature: task-management-rbac
 */
import { describe, it, expect } from 'vitest';
import {
  RegistroSchema,
  LoginSchema,
  CriarTarefaSchema,
  AtualizarTarefaSchema,
  AlterarPapelSchema,
  parseBody,
} from '@/lib/validations';

// ─── RegistroSchema ───────────────────────────────────────────

describe('RegistroSchema', () => {
  it('aceita e-mail válido e senha com 8 caracteres', () => {
    const r = RegistroSchema.safeParse({ email: 'a@b.com', senha: '12345678' });
    expect(r.success).toBe(true);
  });

  it('aceita senha com exatamente 128 caracteres', () => {
    const r = RegistroSchema.safeParse({ email: 'a@b.com', senha: 'a'.repeat(128) });
    expect(r.success).toBe(true);
  });

  it('rejeita senha com 7 caracteres', () => {
    const r = RegistroSchema.safeParse({ email: 'a@b.com', senha: '1234567' });
    expect(r.success).toBe(false);
  });

  it('rejeita senha com 129 caracteres', () => {
    const r = RegistroSchema.safeParse({ email: 'a@b.com', senha: 'a'.repeat(129) });
    expect(r.success).toBe(false);
  });

  it('rejeita e-mail sem @', () => {
    const r = RegistroSchema.safeParse({ email: 'invalido', senha: '12345678' });
    expect(r.success).toBe(false);
  });

  it('rejeita e-mail vazio', () => {
    const r = RegistroSchema.safeParse({ email: '', senha: '12345678' });
    expect(r.success).toBe(false);
  });

  it('rejeita ausência de campo email', () => {
    const r = RegistroSchema.safeParse({ senha: '12345678' });
    expect(r.success).toBe(false);
  });

  it('rejeita ausência de campo senha', () => {
    const r = RegistroSchema.safeParse({ email: 'a@b.com' });
    expect(r.success).toBe(false);
  });
});

// ─── LoginSchema ─────────────────────────────────────────────

describe('LoginSchema', () => {
  it('aceita e-mail válido e senha não vazia', () => {
    const r = LoginSchema.safeParse({ email: 'x@y.com', senha: 'qualquer' });
    expect(r.success).toBe(true);
  });

  it('rejeita senha vazia', () => {
    const r = LoginSchema.safeParse({ email: 'x@y.com', senha: '' });
    expect(r.success).toBe(false);
  });

  it('rejeita e-mail inválido', () => {
    const r = LoginSchema.safeParse({ email: 'nao-e-email', senha: 'abc' });
    expect(r.success).toBe(false);
  });
});

// ─── CriarTarefaSchema ────────────────────────────────────────

describe('CriarTarefaSchema', () => {
  it('aceita título 1 char, sem descrição, prioridade válida', () => {
    const r = CriarTarefaSchema.safeParse({ titulo: 'T', prioridade: 'Alta' });
    expect(r.success).toBe(true);
  });

  it('aceita título com 100 caracteres', () => {
    const r = CriarTarefaSchema.safeParse({ titulo: 'T'.repeat(100), prioridade: 'Baixa' });
    expect(r.success).toBe(true);
  });

  it('aceita todas as prioridades válidas', () => {
    for (const p of ['Baixa', 'Média', 'Alta'] as const) {
      const r = CriarTarefaSchema.safeParse({ titulo: 'T', prioridade: p });
      expect(r.success).toBe(true);
    }
  });

  it('rejeita título vazio', () => {
    const r = CriarTarefaSchema.safeParse({ titulo: '', prioridade: 'Alta' });
    expect(r.success).toBe(false);
  });

  it('rejeita título com 101 caracteres', () => {
    const r = CriarTarefaSchema.safeParse({ titulo: 'T'.repeat(101), prioridade: 'Alta' });
    expect(r.success).toBe(false);
  });

  it('rejeita prioridade inválida', () => {
    const r = CriarTarefaSchema.safeParse({ titulo: 'T', prioridade: 'Urgente' });
    expect(r.success).toBe(false);
  });
});

// ─── AtualizarTarefaSchema ────────────────────────────────────

describe('AtualizarTarefaSchema', () => {
  it('aceita apenas titulo', () => {
    const r = AtualizarTarefaSchema.safeParse({ titulo: 'Novo título' });
    expect(r.success).toBe(true);
  });

  it('aceita apenas prioridade', () => {
    const r = AtualizarTarefaSchema.safeParse({ prioridade: 'Média' });
    expect(r.success).toBe(true);
  });

  it('aceita apenas descricao', () => {
    const r = AtualizarTarefaSchema.safeParse({ descricao: 'Nova descrição' });
    expect(r.success).toBe(true);
  });

  it('aceita todos os campos juntos', () => {
    const r = AtualizarTarefaSchema.safeParse({ titulo: 'T', descricao: 'D', prioridade: 'Alta' });
    expect(r.success).toBe(true);
  });

  it('rejeita objeto vazio (nenhum campo fornecido)', () => {
    const r = AtualizarTarefaSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it('rejeita titulo vazio', () => {
    const r = AtualizarTarefaSchema.safeParse({ titulo: '' });
    expect(r.success).toBe(false);
  });

  it('rejeita titulo com 101 caracteres', () => {
    const r = AtualizarTarefaSchema.safeParse({ titulo: 'T'.repeat(101) });
    expect(r.success).toBe(false);
  });
});

// ─── AlterarPapelSchema ───────────────────────────────────────

describe('AlterarPapelSchema', () => {
  it('aceita "Chefe"', () => {
    expect(AlterarPapelSchema.safeParse({ papel: 'Chefe' }).success).toBe(true);
  });

  it('aceita "Desenvolvedor"', () => {
    expect(AlterarPapelSchema.safeParse({ papel: 'Desenvolvedor' }).success).toBe(true);
  });

  it('rejeita papel inválido', () => {
    expect(AlterarPapelSchema.safeParse({ papel: 'Admin' }).success).toBe(false);
  });

  it('rejeita ausência do campo papel', () => {
    expect(AlterarPapelSchema.safeParse({}).success).toBe(false);
  });
});

// ─── parseBody ────────────────────────────────────────────────

describe('parseBody', () => {
  it('retorna dados validados para input válido', () => {
    const result = parseBody(RegistroSchema, { email: 'a@b.com', senha: '12345678' });
    expect(result).not.toBeInstanceOf(Response);
    expect((result as { email: string }).email).toBe('a@b.com');
  });

  it('retorna Response 422 para input inválido', async () => {
    const result = parseBody(RegistroSchema, { email: 'invalido', senha: '123' });
    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('Dados inválidos');
    expect(Array.isArray(body.details)).toBe(true);
    expect(body.details.length).toBeGreaterThan(0);
  });

  it('details contém campo e mensagem', async () => {
    const result = parseBody(RegistroSchema, { email: 'invalido', senha: '123' });
    const res = result as Response;
    const body = await res.json();
    const detail = body.details[0];
    expect(detail).toHaveProperty('campo');
    expect(detail).toHaveProperty('mensagem');
  });
});
