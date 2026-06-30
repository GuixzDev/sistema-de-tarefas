/** @type {import('next').NextConfig} */
const nextConfig = {
  // Otimizações para deploy serverless na Vercel
  poweredByHeader: false,   // remove header X-Powered-By por segurança
  compress: true,           // compressão gzip/brotli habilitada
  reactStrictMode: true,
};

export default nextConfig;