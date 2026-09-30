# Security Policy

## Supported Versions

This repository is pre-1.0. Security fixes are applied to the latest published
minor version.

## Reporting a Vulnerability

Please do not open a public issue for a suspected security vulnerability.
Use GitHub's private security advisory workflow for the repository instead.

A good report includes:

- affected version;
- minimal reproduction;
- security impact;
- whether the issue can produce an incorrect autonomy decision;
- whether sensitive data can be exposed;
- proposed mitigation, if known.

## Security Scope

Guardrail is a policy-decision library. It does **not** execute external actions,
perform authentication, store credentials, authorize a user, call an AI model,
or replace server-side access control.

Applications remain responsible for enforcing the returned decision at the
actual action boundary.
