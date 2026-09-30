# Changelog

All notable changes to this project are documented in this file.

The format is based on Keep a Changelog principles and the project follows
semantic versioning for public releases.

## [0.1.0] - 2026-09-17

### Added

- Deterministic, synchronous guardrail evaluation.
- Exact-action policy registry with duplicate protection.
- Guarded-autonomy dispositions: observe, recommend, draft, request approval,
  execute, and escalate.
- Controls for permissions, confidence, risk, reversibility, provider
  constraints, and caller-supplied settings.
- Fail-closed missing-policy behavior.
- Structured machine-readable reasons for every decision.
- Runtime validation for policies and evaluation context.
- Zero runtime dependencies.
- Comprehensive Node test-runner suite and built-in coverage command.
- Security, policy-model, and open-source-boundary documentation.
