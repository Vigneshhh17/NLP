/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/api/analyze': ['./data/index/**/*', './data/ddi-kb.json', './data/aliases.json']
    }
  }
};
export default nextConfig;