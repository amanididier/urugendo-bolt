# Technical Context: Urugendo

## Technology Stack

| Technology   | Version | Purpose                         |
| ------------ | ------- | ------------------------------- |
| Next.js      | 16.x    | React framework with App Router |
| React        | 19.x    | UI library                      |
| TypeScript   | 5.9.x   | Type-safe JavaScript            |
| Tailwind CSS | 4.x     | Utility-first CSS               |
| Framer Motion| 12.x    | Animations                      |
| Lucide React | 0.462   | Icons                           |
| vaul         | 1.1.x   | Bottom sheet drawers            |
| date-fns     | 4.x     | Date formatting                 |
| Bun          | Latest  | Package manager & runtime       |

## Development Commands

```bash
bun install        # Install dependencies
bun dev            # Start dev server
bun run build      # Production build
bun lint           # Run ESLint
bun typecheck      # Run TypeScript type checking
```

## Design Tokens (in globals.css via @theme)

- Primary green: #00B85C
- Accent amber: #F59E0B
- Background: #FFFFFF (inside), #F9FAFB (between sections)
- Card border: #E4E4E7
- Text: #09090B (primary), #3F3F46 (secondary), #A1A1AA (muted)

## Configuration

- Next.js App Router enabled
- TypeScript strict mode
- Path alias: @/* → src/*
- Tailwind CSS 4 with @theme directive
- Plus Jakarta Sans font via next/font/google

## Deployment

- Vercel deployment
- Bun package manager (bun.lock preserved)
