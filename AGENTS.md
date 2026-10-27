# Workbench development

Implement the next catalog batch in isolated Git worktrees. Parallel agents own disjoint project directories; the primary agent integrates commits and updates the root catalog after verification. Each project owns its application source, migrations, locks, design decisions and acceptance evidence. Update its status only after the corresponding checks pass.

Before React implementation or refactoring, read [.agents/skills/react-best-practices/SKILL.md](.agents/skills/react-best-practices/SKILL.md) and the applicable rules. Translate Next.js-specific examples to the supported React/Vite runtime; the template remains the build authority.

Before UI delivery, apply [.agents/skills/web-design-guidelines/SKILL.md](.agents/skills/web-design-guidelines/SKILL.md) to changed source and verify the real browser flow. Resolve applicable findings and record remaining limitations.

For a new workbench's visual design, read [docs/design-principles.md](docs/design-principles.md) and write its own `app/DESIGN.md` before selecting layout and tokens.

Autosave is a required product behavior. Before implementing or changing persistence, read [the autosave contract](scripts/blueprints/AUTOSAVE.md). Persist complete working copies, including unfinished editors, and distinguish saved models, saved drafts, pending writes and conflicts. Verify typing during a delayed save, lost-response retry, invalid-draft restoration and import as a new document.

Design each interface around its product's native task: canvas, technical sheet, editor, map, presentation stage or review desk. Use its own spatial hierarchy and interaction model. After browser acceptance, add a real screenshot to `docs/screenshots/` and link it from the root README, using ordinary demonstration data.

Run `pnpm workbench prepare <slug>` to fetch the pinned official toolchain. Then read that project's `.template-guidance/SKILL.md` and relevant topics. Business code belongs in `app/`; the downloaded SDK/tooling and user data stay ignored. Preserve source identities and applied migrations.

Check, test, exercise persistence and failure states in a real browser, then package each implemented app. Distinguish local acceptance, real Host calls and imported-client verification. GitHub publishing is authorized for this public repository; credentials and preview data are outside publication scope.
