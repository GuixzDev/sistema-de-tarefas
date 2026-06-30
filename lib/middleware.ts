/**
 * lib/middleware.ts
 * Helpers de autenticação e controle de acesso (RBAC) para as API Routes.
 *
 * Uso padrão em um handler protegido:
 *
 *   export async function POST(request: Request) {
 *     const authResult = requireAuth(request);
 *     if (authResult instanceof Response) return authResult;
 *
 *     const accessResult = requirePapel(authResult, ['Chefe']);
 *     if (accessResult) return accessResult;
 *
 *     // lógica de negócio...
 *   }
 */
import { NextResponse } from 'next/server';
import {
  extractBearer,
  verifyToken,
  TokenExpiredError,
  TokenInvalidError,
} from '@/lib/auth';
import type { JWTPayload, Papel } from '@/types';

// ---------------------
// Helpers de resposta de erro
// ---------------------

function errorResponse(message: string, status: number): Response {
  return NextResponse.json({ error: message }, { status });
}

// ---------------------
// requireAuth
// ---------------------

/**
 * Extrai e verifica o JWT do header Authorization da requisição.
 *
 * @returns JWTPayload se o token for válido e não expirado.
 *          Response HTTP 401 nos seguintes casos:
 *          - Header Authorization ausente ou sem token Bearer
 *          - Token expirado
 *          - Token inválido ou malformado
 */
export function requireAuth(request: Request): JWTPayload | Response {
  const authHeader = request.headers.get('Authorization');
  const token = extractBearer(authHeader);

  if (!token) {
    return errorResponse('Token não fornecido', 401);
  }

  try {
    return verifyToken(token);
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      return errorResponse('Token expirado', 401);
    }
    if (err instanceof TokenInvalidError) {
      return errorResponse('Token inválido', 401);
    }
    // Erro inesperado — trata como token inválido por segurança
    return errorResponse('Token inválido', 401);
  }
}

// ---------------------
// requirePapel
// ---------------------

/**
 * Verifica se o payload JWT contém um dos papéis permitidos.
 *
 * Também rejeita papéis desconhecidos (diferentes de 'Chefe' e 'Desenvolvedor')
 * com HTTP 403, prevenindo tokens adulterados de acessar qualquer rota.
 *
 * @param payload - JWTPayload retornado por requireAuth
 * @param papeis  - Lista de papéis autorizados para a operação
 * @returns null se autorizado; Response HTTP 403 se não autorizado
 */
export function requirePapel(
  payload: JWTPayload,
  papeis: Papel[]
): Response | null {
  // Rejeita papéis desconhecidos (não é 'Chefe' nem 'Desenvolvedor')
  const papeisValidos: Papel[] = ['Chefe', 'Desenvolvedor'];
  if (!papeisValidos.includes(payload.papel)) {
    return errorResponse('Acesso negado', 403);
  }

  // Verifica se o papel do usuário está na lista de papéis permitidos
  if (!papeis.includes(payload.papel)) {
    return errorResponse('Acesso negado', 403);
  }

  return null; // autorizado
}
