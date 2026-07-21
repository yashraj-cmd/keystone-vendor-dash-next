/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Server-only native/heavy packages — keep them out of the client bundle.
  experimental: {
    serverComponentsExternalPackages: ["googleapis", "@prisma/client", "bcryptjs", "nodemailer"],
  },
};

export default nextConfig;
