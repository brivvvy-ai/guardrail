# Security Model

Guardrail is a decision component, not a complete security boundary.

## What Guardrail does

- validates policy and context input at runtime;
- evaluates deterministic controls;
- fails closed when no policy exists;
- prevents failed controls from increasing autonomy;
- exposes structured, bounded rationale;
- performs no network or model calls;
- stores no credentials;
- logs nothing by itself.

## What Guardrail does not do

Guardrail does not:

- authenticate users;
- authorize requests at a server boundary;
- execute tools or provider operations;
- prove that a caller-supplied confidence score is trustworthy;
- calculate business or application risk;
- encrypt data;
- persist audit logs;
- rate-limit actions;
- provide tenant isolation;
- protect a process from malicious code running in the same trust boundary.

## Enforcement requirement

Applications must enforce the decision at the real action boundary.

Bad:

```ts
const decision = guardrail.evaluate(context);
showDecision(decision);
await provider.performAction(); // decision ignored
```

Good:

```ts
const decision = guardrail.evaluate(context);

if (!decision.canExecute) {
  return decision;
}

await provider.performAction();
```

For sensitive systems, the enforcement point should be server-side and should
also apply the application's own authentication, authorization, tenancy, audit,
and provider controls.

## Sensitive data

Do not put secrets into:

- action names;
- permission names;
- provider-constraint names;
- policy descriptions;
- reason text;
- generic settings.

Guardrail intentionally avoids returning actual setting values in setting
mismatch reasons. Applications should apply their own redaction rules before
persisting or transmitting decision objects.

## Fail-closed behavior

Missing policy defaults to `escalate`. Unknown values required by a control
fail that control. This prevents absence of information from being interpreted
as evidence that execution is safe.
