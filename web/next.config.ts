import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the floating dev overlay (Route / Bundler / Route Info popup) so demos
  // look like a real product. Production builds hide it automatically; this
  // makes sure it's off during dev too.
  devIndicators: false,
};

export default nextConfig;
