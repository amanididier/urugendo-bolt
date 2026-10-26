# Tech Stack

- React with TypeScript
- React Router (routes kept in `src/App.tsx`)
- Tailwind CSS for styling
- shadcn/ui component library (pre‑built components)
- Lucide React for icons
- Radix UI primitives (accessed via shadcn/ui)
- Vite as the build tool
- ESLint and Prettier for code quality
- Jest and React Testing Library for testing (optional)
- Zustand or React Query for state management (if needed)

# Usage Rules

- All source code must reside in the `src` folder.
- Place pages in `src/pages/` and components in `src/components/`.
- The main (default) page is `src/pages/Index.tsx`; update this file to include any new components so they are visible.
- Always prefer shadcn/ui components. Do **not** edit the shipped shadcn/ui files directly; if you need customization, create a new wrapper component that extends or styles the shadcn/ui component.
- Use Tailwind CSS classes for layout, spacing, colors, typography, and other design aspects. Avoid writing custom CSS unless absolutely necessary.
- For icons, import from `lucide-react` (e.g., `import { IconName } from "lucide-react"`).
- Keep all route definitions in `src/App.tsx`. Do not add route configuration elsewhere.
- Write code in TypeScript with strict typing; avoid `any` unless unavoidable and justified.
- Follow the existing code style (ESLint + Prettier). Run linting/formatting before committing.
- When adding new dependencies, prefer those already installed (shadcn/ui, Radix, Lucide, etc.). If a new package is required, install it via the appropriate command and document its purpose.