/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--c-surface) / <alpha-value>)',
          subtle: 'rgb(var(--c-surface-subtle) / <alpha-value>)',
          strong: 'rgb(var(--c-surface-strong) / <alpha-value>)',
          done: 'rgb(var(--c-surface-done) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--c-line) / <alpha-value>)',
          strong: 'rgb(var(--c-line-strong) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',
          2: 'rgb(var(--c-ink-2) / <alpha-value>)',
          3: 'rgb(var(--c-ink-3) / <alpha-value>)',
          disabled: 'rgb(var(--c-ink-disabled) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          soft: 'rgb(var(--c-accent-soft) / <alpha-value>)',
          line: 'rgb(var(--c-accent-line) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--c-success) / <alpha-value>)',
          soft: 'rgb(var(--c-success-soft) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--c-warning) / <alpha-value>)',
          soft: 'rgb(var(--c-warning-soft) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--c-danger) / <alpha-value>)',
          soft: 'rgb(var(--c-danger-soft) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Microsoft YaHei UI"',
          '"Microsoft YaHei"',
          '"Noto Sans SC"',
          '"Source Han Sans SC"',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        cap: ['12px', { lineHeight: '1.4' }],
        sm2: ['13px', { lineHeight: '1.5' }],
        body: ['14px', { lineHeight: '1.55' }],
        h2: ['17px', { lineHeight: '1.35' }],
        h1: ['24px', { lineHeight: '1.2' }],
        metric: ['34px', { lineHeight: '1.05' }],
      },
      borderRadius: {
        ctl: '10px',
        card: '14px',
        sheet: '20px',
      },
      boxShadow: {
        sheet: '0 -8px 32px rgba(16,24,40,0.12)',
        modal: '0 16px 48px rgba(16,24,40,0.18)',
      },
    },
  },
  plugins: [],
}
