# Meowstik Copilot Instructions

## Build, Run, and Test

- **Run Development Server**: `npm run dev`
  - Starts the Express server which serves the React client via Vite middleware.
  - Access at `http://localhost:5000` (or configured PORT).
- **Build Client**: `npm run build`
  - compiles the React application to `dist/public`.
- **Database Management**:
  - `npm run db:push`: Push schema changes to the database.
  - `npm run db:studio`: Open Drizzle Studio to view/edit data.
- **Testing**:
  - There is no central test runner (Jest/Vitest) configured.
  - Run standalone test scripts using `tsx`:
    - Example: `npx tsx test-storage.ts`
    - Example: `npx tsx scripts/test-file-ingest.ts`

## High-Level Architecture

Meowstik is a monorepo "Meta-Agent Platform" that orchestrates multiple agents:

1.  **Core Server (`server/`)**: 
    - Node.js/Express backend.
    - Acts as the central "Brain".
    - Manages database (PostgreSQL via Drizzle ORM).
    - Handles auth (Google OAuth via Passport).
    - Communicates with agents via WebSockets.
2.  **Client (`client/`)**:
    - React/Vite SPA.
    - The "Face" of the application.
    - Uses `wouter` for routing and `@tanstack/react-query` for data fetching.
3.  **Desktop Agent (`desktop-agent/`)**:
    - Node.js application running on the host machine.
    - Uses `@nut-tree-fork/nut-js` for mouse/keyboard control.
    - Captures screen/audio and streams to server.
4.  **Browser Extension (`browser-extension/`)**:
    - Chrome extension for browser automation and context.
5.  **Local Agent (`local-agent/`)**:
    - Playwright-based headless browser for background tasks.

## Key Conventions

- **Path Aliases**:
  - `@/*` resolves to `client/src/*` (e.g., `@/components/ui/button`).
  - `@shared/*` resolves to `shared/*`.
- **Database**:
  - Schema defined in `shared/schema.ts`.
  - Use `db` export from `server/db.ts` for queries.
  - Always use Drizzle ORM for database interactions.
- **Frontend Architecture**:
  - **Routing**: Use `wouter` (`<Switch>`, `<Route>`, `useLocation`). Do NOT use `react-router`.
  - **State**: Use `useQuery` / `useMutation` from `@tanstack/react-query` for all server data.
  - **Styling**: Tailwind CSS with `shadcn/ui` components.
  - **Forms**: `react-hook-form` with `zod` validation (`drizzle-zod` often used).
- **Backend Architecture**:
  - **Routes**: Defined in `server/routes.ts` (and `server/routes/` for specific modules).
  - **WebSockets**: Handlers in `server/websocket-*.ts`.
  - **Execution**: Use `tsx` for running TypeScript files directly.
- **Code Style**:
  - Prefer functional components and hooks.
  - Use `export default` for pages, named exports for components/utils.
  - Ensure all async operations are properly error-handled.
