const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        card: token('card'),
        card2: token('card2'),
        line: token('line'),
        ink: token('ink'),
        ink2: token('ink2'),
        muted: token('muted'),
        faint: token('faint'),
        brand: token('brand'),
        'brand-hover': token('brand-hover'),
        'brand-ink': token('brand-ink'),
        ok: token('ok'),
        warn: token('warn'),
        hi: token('hi'),
        bad: token('bad'),
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--c-ink) / 0.04), 0 8px 24px -12px rgb(var(--c-brand) / 0.18)',
      },
    },
  },
  plugins: [],
};
