# Workbench development

Implement projects sequentially in the order recorded in `catalog.json`. Each project owns its application source, migrations, locks, design decisions and acceptance evidence. Update its status only after the corresponding checks pass.

Before React implementation or refactoring, read [.agents/skills/react-best-practices/SKILL.md](.agents/skills/react-best-practices/SKILL.md) and the applicable rules. Translate Next.js-specific examples to the supported React/Vite runtime; the template remains the build authority.

Before UI delivery, apply [.agents/skills/web-design-guidelines/SKILL.md](.agents/skills/web-design-guidelines/SKILL.md) to changed source and verify the real browser flow. Resolve applicable findings and record remaining limitations.

For a new workbench's visual design, read [docs/design-principles.md](docs/design-principles.md) and write its own `app/DESIGN.md` before selecting layout and tokens.

Run `pnpm workbench prepare <slug>` to fetch the pinned official toolchain. Then read that project's `.template-guidance/SKILL.md` and relevant topics. Business code belongs in `app/`; the downloaded SDK/tooling and user data stay ignored. Preserve source identities and applied migrations.

Check, test, exercise persistence and failure states in a real browser, then package each implemented app. Distinguish local acceptance, real Host calls and imported-client verification. GitHub publishing is authorized for this public repository; credentials and preview data are outside publication scope.
