import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * Next 16 removed the `next lint` wrapper, so ESLint is invoked directly
 * and needs a flat config. `eslint-config-next` already publishes
 * flat-config arrays, so they are spread in as-is.
 */
const config = [
  { ignores: [".next/**", "out/**", "node_modules/**"] },
  ...coreWebVitals,
  ...typescript,
];

export default config;
