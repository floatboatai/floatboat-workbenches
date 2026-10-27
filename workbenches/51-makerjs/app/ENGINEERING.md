# Engineering

The business app root is this directory. Run the authoring commands from the repository root; see `../AGENTS.md`.

- `src/server/` owns business routes, parameterized SQL, transactions and Host SDK calls. Register public page routes under `/api/` through the provided server.
- `src/ui/` owns React components and the authenticated page connection. UI requests go through `page.fetch`; importing Node, database or Host implementations into the browser is rejected.
- `src/contracts/` contains shared serializable data types and response validation. Validate external input as unknown and return structured results.
- Append numbered SQL migrations. Applied migrations are immutable; preview data is persistent and must not be silently reset to accommodate changes.
- Keep the fixed strict `tsconfig.json` and declarative manifest build profile. The compiler ignores executable project build config and env files. Source assets belong under `src/`.
- Keep runtime dependency versions and lockfiles aligned; see `../docs/maintenance.md`. Native extensions do not belong in the application profile.
- Add tests for business boundaries and persistence behavior, using temporary data rather than the user's preview database. Test files live under `tests/` and are run by `pnpm test` from the repository root.
- Host calls are optional and require actual authorization. Show unavailable/error states and consult `../docs/platform.md`; preserve execution-unknown errors rather than retrying potentially completed external mutations blindly.
