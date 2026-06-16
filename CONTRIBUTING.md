# Contributing to Screenplay Studio

Thank you for considering contributing! This project is developed by a solo creator and every contribution helps.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/screenplay-studio.git`
3. Create a feature branch: `git checkout -b feat/your-feature`
4. Install dependencies: `npm install`
5. Copy `.env.local.example` to `.env.local` and fill in the required values
6. Start the dev server: `npm run dev`

## Development

- Run `npm run dev` for the Next.js dev server (with Turbopack)
- Run `npm run test` to execute tests
- Run `npm run lint` to check code style
- Run `npm run typecheck` if a script exists, or rely on your IDE

## Code Style

- TypeScript strict mode is enabled — no `any` unless absolutely necessary
- Use the path alias `@/` for imports from `src/`
- Follow existing patterns in the codebase
- Components are in `src/components/`, pages in `src/app/`, logic in `src/lib/`
- Tests go in `tests/` and use Vitest

## Pull Requests

- Keep PRs focused on a single concern
- Write clear commit messages (conventional commits welcome)
- Ensure all existing tests pass
- Add tests for new functionality when applicable
- Update documentation if needed

## Questions?

Open a discussion or issue on GitHub.
