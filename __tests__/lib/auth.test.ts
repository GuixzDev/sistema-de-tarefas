/**
 * Testes unitários para lib/auth.ts
 * Cobre: signToken, verifyToken, extractBearer
 * Feature: task-management-rbac
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  signToken,
  verifyToken,
  extractBearer,
  TokenExpiredError,
  TokenInvalidError,
} from '@/lib/auth';

// Definir JWT_SECRET no ambiente de teste
beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-minimo-32-chars-para-teste-unitario';
});

afterEach(() => {
  delete process.env.JWT_SECRET;
  vi.restoreAllMocks();
});

describe('signToken', () => {
  it('retorna uma string com 3 partes separadas por ponto (formato JWT)', () => {
    const token = signToken({ id: 'uuid-1', papel: 'Chefe' });
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
  });

  it('payload decodificado contém id e papel corretos', () => {
    const token = signToken({ id: 'uuid-abc', papel: 'Desenvolvedor' });
    const payload = verifyToken(token);
    expect(payload.id).toBe('uuid-abc');
    expect(payload.papel).toBe('Desenvolvedor');
  });

  it('lança erro se JWT_SECRET não estiver definido', () => {
    delete process.env.JWT_SECRET;
    expect(() => signToken({ id: 'x', papel: 'Chefe' })).toThrow();
  });
});

describe('verifyToken — token válido', () => {
  it('retorna payload com id e papel corretos (round-trip)', () => {
    const token = signToken({ id: 'id-round-trip', papel: 'Chefe' });
    const payload = verifyToken(token);
    expect(payload.id).toBe('id-round-trip');
    expect(payload.papel).toBe('Chefe');
  });

  it('payload contém iat e exp', () => {
    const token = signToken({ id: 'id-1', papel: 'Desenvolvedor' });
    const payload = verifyToken(token);
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
  });

  it('exp é aproximadamente 8 horas após iat', () => {
    const token = signToken({ id: 'id-1', papel: 'Chefe' });
    const payload = verifyToken(token);
    const diff = payload.exp! - payload.iat!;
    expect(diff).toBe(8 * 60 * 60); // 28800 segundos
  });
});

describe('verifyToken — token inválido', () => {
  it('lança TokenInvalidError para token malformado', () => {
    expect(() => verifyToken('nao.e.um.jwt.valido')).toThrow(TokenInvalidError);
  });

  it('lança TokenInvalidError para string aleatória', () => {
    expect(() => verifyToken('totalmente-invalido')).toThrow(TokenInvalidError);
  });

  it('lança TokenInvalidError para token com assinatura incorreta', () => {
    const token = signToken({ id: 'id-1', papel: 'Chefe' });
    // Alterar o último caractere da assinatura
    const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
    expect(() => verifyToken(tampered)).toThrow(TokenInvalidError);
  });

  it('lança TokenExpiredError para token expirado', async () => {
    // Gerar token com expiração no passado usando jwt diretamente
    const jwt = await import('jsonwebtoken');
    const expired = jwt.sign(
      { id: 'id-1', papel: 'Chefe' },
      process.env.JWT_SECRET!,
      { expiresIn: -1 } // expirado há 1 segundo
    );
    expect(() => verifyToken(expired)).toThrow(TokenExpiredError);
  });
});

describe('extractBearer', () => {
  it('retorna o token de um header válido', () => {
    expect(extractBearer('Bearer meu-token-aqui')).toBe('meu-token-aqui');
  });

  it('retorna null para header null', () => {
    expect(extractBearer(null)).toBeNull();
  });

  it('retorna null para header undefined', () => {
    expect(extractBearer(undefined)).toBeNull();
  });

  it('retorna null para string vazia', () => {
    expect(extractBearer('')).toBeNull();
  });

  it('retorna null quando falta o prefixo Bearer', () => {
    expect(extractBearer('meu-token-sem-bearer')).toBeNull();
  });

  it('retorna null para prefixo incorreto (Basic)', () => {
    expect(extractBearer('Basic dXNlcjpzZW5oYQ==')).toBeNull();
  });

  it('retorna null para "Bearer " sem token após o espaço', () => {
    expect(extractBearer('Bearer ')).toBeNull();
  });

  it('é case-insensitive para o prefixo bearer', () => {
    expect(extractBearer('bearer meu-token')).toBe('meu-token');
    expect(extractBearer('BEARER meu-token')).toBe('meu-token');
  });
});
