# Gamely

Next.js app for the Gamely rooms-and-games experience.

## Setup

1. Install dependencies with `npm install`.
2. Ensure `DATABASE_URL` points at the local SQLite database used by Prisma.
3. Generate the Prisma client with `npm run db:generate` when schema changes.
4. Start the app with `npm run dev`.
5. Set `NEXT_ALLOWED_DEV_ORIGINS` when you need extra local or tunnel origins in development.

## Scripts

- `npm run dev` starts the development server.
- `npm run build` creates a production build.
- `npm run lint` runs ESLint.
- `npm test` runs the Vitest suite once.
- `npm run test:watch` runs Vitest in watch mode.

## Tests

The test suite focuses on shared server helpers such as session lifecycle and room cleanup. Those are the highest-risk areas because they coordinate auth, room state, and game cleanup.
