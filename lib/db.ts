/**
 * lib/db.ts
 * Conexão singleton com o banco de dados PostgreSQL (Supabase).
 * Usa a biblioteca `postgres` (npm) com SQL parametrizado.
 *
 * A instância `sql` é compartilhada em todo o projeto para evitar
 * criação excessiva de conexões em ambiente serverless (Vercel).
 */
import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  throw new Error(
    'Variável de ambiente DATABASE_URL não definida. ' +
    'Copie .env.local.example para .env.local e preencha os valores.'
  );
}

/**
 * Cliente PostgreSQL configurado para o Supabase.
 * - ssl: 'require' — obrigatório para conexões remotas ao Supabase
 * - max: 10 — limite de conexões no pool (adequado para serverless)
 * - idle_timeout: 20 — fecha conexões ociosas após 20s
 * - connect_timeout: 10 — timeout de conexão de 10s
 */
const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export default sql;
