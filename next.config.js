/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  // Force fresh builds
  generateBuildId: async () => {
    return `build-${Date.now()}`
  }
}

module.exports = nextConfig

