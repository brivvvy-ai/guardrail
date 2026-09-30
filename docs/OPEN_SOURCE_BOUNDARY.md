# Open-source Boundary

This repository is intentionally generic.

It contains a deterministic policy engine for guarded autonomy and the public
engineering primitives necessary to use it. It does not contain private Brivvvy
product intelligence or operational implementation.

The repository must not include:

- customer or tenant data;
- credentials, tokens, private keys, or environment secrets;
- private production configuration;
- proprietary prompts;
- proprietary business-learning logic;
- internal ranking or prioritization heuristics;
- private memory schemas or learned business data;
- internal agent orchestration or coalition logic;
- unpublished product telemetry;
- production provider credentials or account identifiers.

Examples and tests use synthetic, generic identifiers only.

Contributors should treat this boundary as part of the security model. When in
doubt, reduce an example to a generic action and generic context before adding
it to the public repository.
