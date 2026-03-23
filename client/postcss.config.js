/**
 * [💭 Analysis]
 * Sovereign PostCSS Configuration (Client-side).
 * Placed in client/ to ensure Vite picks it up correctly when root is set to client.
 */
export default {
  plugins: {
    'postcss-import': {},
    'tailwindcss/nesting': {},
    tailwindcss: {},
    autoprefixer: {},
  },
};
