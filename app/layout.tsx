import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Task Management RBAC',
  description: 'Sistema de Gerenciamento de Tarefas com RBAC',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
