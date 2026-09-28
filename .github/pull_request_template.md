## Summary

<!-- What changed and why. Link the issue if there is one. -->

## Checklist (AGENTS.md)

- [ ] A behavior change started as a failing test (golden HTML in `tests/render.test.ts`, a lint case in `tests/lint.test.ts`, a pairing case in `tests/parse.test.ts`)
- [ ] `bun run check && bun run typecheck && bun run test && bun run test:dist`
- [ ] `bun run test:coverage` (95% floor) and `bun run check:consumer`
- [ ] No code, CSS or text copied from osu-web or the osu! wiki
- [ ] The README's API, supported tags and lint codes still match `src/`
- [ ] A line under `## [Unreleased]` in `CHANGELOG.md` for anything users will notice
