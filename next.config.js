/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    styledComponents: true,
  },
  webpack: (config, options) => {
    config.resolve.extensions.push(".js");
    config.resolve.fallback = { fs: false };
    config.experiments = { ...(config?.experiments ?? {}), topLevelAwait: true };
    return config;
  },
};

module.exports = nextConfig;
