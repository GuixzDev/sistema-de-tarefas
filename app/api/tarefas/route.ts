/**
 * GET  /api/tarefas  — Lista tarefas filtradas por papel
 * POST /api/tarefas  — Cria nova tarefa (apenas Chefe)
 */
import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireAuth, requirePapel } from '@/lib/middleware';
import { parseBody, CriarTarefaSchema } from '@/lib/validations';

// ─────────────────────────────────────────────
// GET /api/tarefas
// ─────────────────────────────────────────────
/**
 * Chefe  → todas as tarefas (sem filtro de status)
 * Desenvolvedor → apenas tarefas com status 'Disponível'
 *
 * Respostas:
 *   200 - Tarefa[]  (array vazio se não houver)
 *   401 - token ausente/inválido/expirado
 *   500 - erro interno
 */
export async function GET(request: Request) {
  try {
    const authResult = requireAuth(request);
    if (authResult instanceof Response) return authResult;

    // Ambos os papéis podem listar — sem requirePapel aqui
    const { papel } = authResult;

    let tarefas;
    if (papel === 'Chefe') {
      tarefas = await sql`
        SELECT
          t.id, t.titulo, t.descricao, t.prioridade, t.status,
          t.responsavel_id, t.assumida_em, t.criado_em, t.atualizado_em,
          u.email AS responsavel_email
        FROM tarefas t
        LEFT JOIN usuarios u ON u.id = t.responsavel_id
        ORDER BY t.criado_em DESC
      `;
    } else {
      tarefas = await sql`
        SELECT
          t.id, t.titulo, t.descricao, t.prioridade, t.status,
          t.responsavel_id, t.assumida_em, t.criado_em, t.atualizado_em,
          u.email AS responsavel_email
        FROM tarefas t
        LEFT JOIN usuarios u ON u.id = t.responsavel_id
        WHERE t.status = 'Disponível'
        ORDER BY t.criado_em DESC
      `;
    }

    return NextResponse.json(tarefas, { status: 200 });
  } catch (err) {
    console.error('[GET /api/tarefas]', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST /api/tarefas
// ─────────────────────────────────────────────
/**
 * Cria uma nova tarefa com status padrão 'Disponível'.
 * Apenas usuários com papel 'Chefe' podem criar tarefas.
 *
 * Body: { titulo: string, descricao?: string, prioridade: 'Baixa' | 'Média' | 'Alta' }
 *
 * Respostas:
 *   201 - Tarefa criada completa
 *   401 - token ausente/inválido/expirado
 *   403 - papel sem permissão
 *   422 - dados inválidos
 *   500 - erro interno
 */
export async function POST(request: Request) {
  try {
    const authResult = requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const accessResult = requirePapel(authResult, ['Chefe']);
    if (accessResult) return accessResult;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Dados inválidos', details: [{ campo: 'body', mensagem: 'JSON inválido ou ausente' }] },
        { status: 422 }
      );
    }

    const parsed = parseBody(CriarTarefaSchema, body);
    if (parsed instanceof Response) return parsed;

    const { titulo, descricao, prioridade } = parsed;

    const result = await sql`
      INSERT INTO tarefas (titulo, descricao, prioridade)
      VALUES (${titulo}, ${descricao ?? null}, ${prioridade})
      RETURNING id, titulo, descricao, prioridade, status, responsavel_id, criado_em, atualizado_em
    `;

    return NextResponse.json(result[0], { status: 201 });
  } catch (err) {
    console.error('[POST /api/tarefas]', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
