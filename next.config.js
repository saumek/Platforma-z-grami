const os = require("node:os");

function getLocalDevOrigins() {
  const hosts = new Set(["localhost", "127.0.0.1"]);
  const interfaces = os.networkInterfaces();

  for (const networkInterface of Object.values(interfaces)) {
    for (const address of networkInterface ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        hosts.add(address.address);
      }
    }
  }

  return Array.from(hosts);
}

/** @type {import('next').NextConfig} */
//const allowedDevOrigins = process.env.NEXT_ALLOWED_DEV_ORIGINS
//  ? process.env.NEXT_ALLOWED_DEV_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
//  : getLocalDevOrigins();
const allowedDevOrigins=['nonfulminating-unpredictively-mardell.ngrok-free.dev']
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  allowedDevOrigins,
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

module.exports = nextConfig;
