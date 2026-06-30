/**
 * lib/auth.ts
 * Funções de autenticação JWT para o sistema Task Management RBAC.
 *
 * Usa a biblioteca `jsonwebtoken` com JWT_SECRET armazenado em variável de ambiente.
 * Tokens têm validade de 8 horas e carregam { id, papel } do usuário.
 */
import jwt from 'jsonwebtoken';
import type { JWTPayload } from '@/types';

// Tipos de erro exportados para uso nos handlers de API
export class TokenExpiredError extends Error {
  constructor() {
    super('Token expirado');
    this.name = 'TokenExpiredError';
  }
}

export class TokenInvalidError extends Error {
  constructor() {
    super('Token inválido');
    this.name = 'TokenInvalidError';
  }
}

/**
 * Obtém o JWT_SECRET das variáveis de ambiente.
 * Lança erro descritivo se não estiver definido.
 */
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'Variável de ambiente JWT_SECRET não definida. ' +
      'Copie .env.local.example para .env.local e preencha os valores.'
    );
  }
  return secret;
}

/**
 * Gera um Token JWT assinado com expiração de 8 horas.
 *
 * @param payload - Dados do usuário: { id, papel }
 * @returns Token JWT assinado como string
 */
export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, getJWTSecret(), { expiresIn: '8h' });
}

/**
 * Verifica e decodifica um Token JWT.
 *
 * @param token - Token JWT como string
 * @returns Payload decodificado { id, papel, iat, exp }
 * @throws TokenExpiredError se o token estiver expirado
 * @throws TokenInvalidError se o token for inválido ou malformado
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, getJWTSecret());
    return decoded as JWTPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError();
    }
    // JsonWebTokenError, NotBeforeError ou qualquer outro erro de JWT
    throw new TokenInvalidError();
  }
}

/**
 * Extrai o token Bearer do header Authorization.
 *
 * @param authHeader - Valor do header Authorization (ex: "Bearer eyJ...")
 * @returns Token como string ou null se ausente/mal formatado
 */
export function extractBearer(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  const token = parts[1];
  if (!token || token.trim() === '') return null;
  return token;
}
