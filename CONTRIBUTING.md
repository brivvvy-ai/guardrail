# Contributing to Brivvvy Guardrail

Thank you for contributing.

## Principles

Changes should preserve the project's core properties:

1. deterministic evaluation;
2. explicit policy;
3. fail-safe behavior;
4. structured explainability;
5. no hidden model reasoning;
6. no runtime model dependency;
7. no secret-dependent behavior;
8. stable, strongly typed public contracts.

## Local Development

```bash
npm install
npm run check
```

Useful individual commands:

```bash
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run secrets:check
```

## Pull Requests

A pull request should include:

- a clear problem statement;
- the behavioral change;
- tests for success and failure paths;
- documentation updates for public API changes;
- no unrelated refactors.

Tests should describe externally observable behavior rather than implementation
internals.

## Public API Changes

Until 1.0, breaking changes are possible. Even so, public API changes should be
intentional, documented in `CHANGELOG.md`, and accompanied by migration notes
when practical.

## Security

Do not include credentials, tokens, customer data, private prompts, private
configuration, or proprietary Brivvvy implementation details in issues,
examples, fixtures, tests, or pull requests.
