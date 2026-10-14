/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // อนุญาตรูปจาก Supabase Storage (public bucket "ticket-files")
  images: { remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co' }] },
};
export default nextConfig;
