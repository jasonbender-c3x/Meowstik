/**
 * [💭 Analysis]
 * Sovereign PostCSS Configuration.
 * Placed in the root to govern the CSS transformation pipeline.
 */
export default {
  plugins: {
    'postcss-import': {},
    'tailwindcss/nesting': {},
    tailwindcss: {},
    autoprefixer: {},
  },
};