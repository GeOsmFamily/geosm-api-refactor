# Contributing to GeOSM API

Thank you for your interest in contributing to GeOSM API. This document provides guidelines and instructions for contributing.

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/geosm-api.git
   cd geosm-api
   ```
3. **Create a branch** for your work:
   ```bash
   git checkout -b feat/your-feature-name
   ```
4. **Install dependencies** and set up your environment (see [README.md](./README.md))
5. **Make your changes**, write tests, and ensure everything passes
6. **Push** your branch and open a **Pull Request**

## Code Style

- **Language**: TypeScript (strict mode)
- **Linting**: ESLint 9 with typescript-eslint
- **Formatting**: Prettier 3

Run these before committing:

```bash
npm run lint        # Check for linting issues
npm run format      # Auto-format code with Prettier
```

## Architecture Guidelines

This project follows **Clean Architecture**. Place your code in the correct layer:

### Domain Layer (`src/domain/`)
- Entity interfaces and value objects
- Enums and constants
- Custom error classes
- Repository interfaces (ports)
- **No dependencies** on external libraries or frameworks

### Application Layer (`src/application/`)
- **Use cases**: One class per business operation, each with a single `execute()` method
- **DTOs**: Data transfer objects for input/output at the application boundary
- **Service interfaces**: Abstract definitions for infrastructure services (email, password, token)
- Depends only on the domain layer

### Infrastructure Layer (`src/infrastructure/`)
- **Repository implementations**: Prisma-based implementations of domain repository interfaces
- **External services**: Redis, MinIO, MeiliSearch, Nominatim, OSRM, QGIS Server, SMTP
- **Queue workers**: BullMQ job processors
- Implements interfaces defined in the domain and application layers

### Presentation Layer (`src/presentation/`)
- **Routes**: Fastify route handlers -- resolve use cases from the DI container, validate input with Zod, and return responses
- **Middleware**: Error handling, RBAC authorization, request logging, metrics
- **Plugins**: Fastify plugin registrations (auth, CORS, Swagger, WebSocket, multipart)
- **Schemas**: Zod validation schemas for request/response

### Key Principles

- Dependencies point inward (presentation -> application -> domain)
- Use the Awilix DI container for dependency injection; register new services in `src/container.ts`
- Use Zod for all request validation
- Follow existing naming conventions: `kebab-case` for files, `PascalCase` for classes, `camelCase` for variables

## Testing

- Write tests using **Vitest**
- Place test files alongside source files or in a `__tests__` directory
- Test use cases independently of infrastructure (mock repositories)

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

All PRs must pass existing tests. New features should include tests.

## Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, no logic change) |
| `refactor` | Code refactoring (no feature or fix) |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build, CI, or tooling changes |

### Examples

```
feat(layers): add bulk import for GeoJSON files
fix(auth): handle expired refresh token rotation correctly
docs(readme): add deployment section
refactor(exports): extract file conversion to dedicated service
test(users): add integration tests for role changes
```

## Pull Request Checklist

Before submitting your PR, verify:

- [ ] Code compiles without errors (`npm run build`)
- [ ] Linting passes (`npm run lint`)
- [ ] All existing tests pass (`npm test`)
- [ ] New tests are written for new features or bug fixes
- [ ] Commit messages follow conventional commit format
- [ ] PR title is concise and descriptive
- [ ] PR description explains the "why" behind the change
- [ ] Database schema changes include a Prisma migration (`npm run db:migrate`)
- [ ] New environment variables are added to `src/config/env.config.ts` with appropriate defaults
- [ ] New routes are registered in `src/server.ts`
- [ ] New services/repositories are registered in `src/container.ts`

## Code of Conduct

Be respectful, constructive, and collaborative. We are committed to providing a welcoming and inclusive experience for everyone. Harassment, discrimination, and disrespectful behavior will not be tolerated.

## Questions?

Open an issue on GitHub for questions, feature requests, or bug reports.
