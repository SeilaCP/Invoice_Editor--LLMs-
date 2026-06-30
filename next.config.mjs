/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdfkit", "fontkit", "linebreak", "png-js"],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  devIndicators: false,
};

export default nextConfig;
