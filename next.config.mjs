/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "pdfkit",
    "fontkit",
    "linebreak",
    "png-js",
    "pdf-parse",
    "pdfjs-dist",
    "@napi-rs/canvas",
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  devIndicators: false,
};

export default nextConfig;
