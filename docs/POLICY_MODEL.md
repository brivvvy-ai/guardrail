# Policy Model

Brivvvy Guardrail v0.1 intentionally uses a small, deterministic policy model.
It is designed to answer one question:

> Given an intended action and observable context, what autonomy state is
> permitted next?

Guardrail does not perform the action.

## Exact-action matching

Each policy owns one exact `action` string. v0.1 does not support wildcards,
regex matching, priorities, inheritance, or multiple competing policies for the
same action.

This is deliberate. Policy selection should not depend on hidden precedence.

## Dispositions

A successful policy can return any guarded-autonomy disposition:

- `observe`
- `recommend`
- `draft`
- `request_approval`
- `execute`
- `escalate`

Failed controls may return only:

- `request_approval`
- `escalate`

A failed control can therefore reduce autonomy but cannot silently increase it.

## Controls

### Permissions

```ts
{
  kind: "permissions",
  allOf: ["message:send"],
  anyOf: ["role:operator", "role:owner"],
  noneOf: ["account:suspended"],
  onFailure: "escalate",
}
```

All supplied clauses are evaluated. One permissions control may therefore
produce more than one structured failure reason.

### Confidence

```ts
{
  kind: "confidence",
  atLeast: 0.95,
  onFailure: "request_approval",
}
```

Confidence is normalized to the inclusive range `0..1`. Guardrail does not
calculate confidence. The caller owns the evidence and calibration behind that
number.

### Risk

```ts
{
  kind: "risk",
  atMost: "medium",
  onFailure: "request_approval",
}
```

Risk ordering is:

```text
low < medium < high < critical
```

### Reversibility

```ts
{
  kind: "reversibility",
  mustBe: true,
  onFailure: "request_approval",
}
```

Unknown reversibility fails the control rather than being assumed.

### Provider constraints

```ts
{
  kind: "provider_constraints",
  noneOf: ["read_only", "writes_disabled"],
  onFailure: "escalate",
}
```

The caller supplies active provider constraints. Guardrail performs no provider
networking or discovery.

### Settings

```ts
{
  kind: "setting",
  key: "external_actions_enabled",
  equals: true,
  onFailure: "request_approval",
}
```

Settings are generic primitives (`string | number | boolean | null`). Guardrail
does not include actual setting values in mismatch explanations, reducing the
chance that an audit record accidentally echoes sensitive configuration.

## Multiple failures

Guardrail evaluates all controls and returns every observable failure.

If any failed control specifies `escalate`, the final disposition is
`escalate`. Otherwise the final disposition is `request_approval`.

This resolution rule is fixed and deterministic in v0.1.

## Missing policies

A missing policy never authorizes execution.

The default is:

```ts
missingPolicyDisposition: "escalate"
```

Applications may explicitly choose `request_approval` instead.

## Validation failures vs policy failures

Malformed configuration is a programming/configuration error and throws a
`GuardrailValidationError` or `GuardrailConfigurationError`.

A valid policy that does not permit autonomous execution returns a normal
`GuardrailDecision`. It does not throw.
