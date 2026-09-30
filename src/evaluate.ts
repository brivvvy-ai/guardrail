/**
 * =============================================================================
 * Brivvvy
 * -----------------------------------------------------------------------------
 * File:
 * evaluate.ts
 *
 * Purpose
 * -----------------------------------------------------------------------------
 * Evaluates one validated action context against one validated Guardrail policy.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Evaluate supported controls deterministically
 * • Collect every failed control rather than hiding uncertainty
 * • Resolve failed controls to approval or escalation without increasing autonomy
 * • Return structured rationale suitable for application audit output
 *
 * Architectural Role
 * -----------------------------------------------------------------------------
 * Layer:
 *   Domain Policy Engine
 *
 * Consumes:
 *   • GuardrailPolicy
 *   • GuardrailContext
 *
 * Produces:
 *   • GuardrailDecision
 *
 * Design Philosophy
 * -----------------------------------------------------------------------------
 * Evaluation is pure with respect to external systems: no network, storage,
 * logging, clocks, random values, or AI models participate in a decision.
 *
 * Dependencies
 * -----------------------------------------------------------------------------
 * • Domain validation
 * • Guardrail domain types
 *
 * Future Enhancements
 * -----------------------------------------------------------------------------
 * □ Versioned evaluation traces for serialized audit records
 *
 * =============================================================================
 */

import {
  type FailureDisposition,
  type GuardrailContext,
  type GuardrailControl,
  type GuardrailDecision,
  type GuardrailPolicy,
  type GuardrailReason,
  type RiskLevel,
} from "./types.js";
import { validateContext, validatePolicy } from "./validation.js";

const RISK_RANK: Readonly<Record<RiskLevel, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

interface FailedControl {
  readonly disposition: FailureDisposition;
  readonly reason: GuardrailReason;
}

/** Evaluates a permission control against the caller's permission set. */
function evaluatePermissions(
  control: Extract<GuardrailControl, { readonly kind: "permissions" }>,
  context: GuardrailContext,
): FailedControl[] {
  const available = new Set(context.permissions ?? []);
  const failures: FailedControl[] = [];

  if (control.allOf !== undefined) {
    const missing = control.allOf.filter((permission) => !available.has(permission));

    if (missing.length > 0) {
      failures.push({
        disposition: control.onFailure,
        reason: {
          code: "PERMISSION_ALL_OF_MISSING",
          control: "permissions",
          message: "One or more required permissions are missing.",
          details: { missing },
        },
      });
    }
  }

  if (control.anyOf !== undefined) {
    const matched = control.anyOf.some((permission) => available.has(permission));

    if (!matched) {
      failures.push({
        disposition: control.onFailure,
        reason: {
          code: "PERMISSION_ANY_OF_MISSING",
          control: "permissions",
          message: "At least one permitted capability is required.",
          details: { requiredAnyOf: control.anyOf },
        },
      });
    }
  }

  if (control.noneOf !== undefined) {
    const forbiddenPresent = control.noneOf.filter((permission) => available.has(permission));

    if (forbiddenPresent.length > 0) {
      failures.push({
        disposition: control.onFailure,
        reason: {
          code: "PERMISSION_FORBIDDEN_PRESENT",
          control: "permissions",
          message: "A forbidden permission is present in the evaluation context.",
          details: { forbiddenPresent },
        },
      });
    }
  }

  return failures;
}

/** Evaluates a normalized confidence threshold. */
function evaluateConfidence(
  control: Extract<GuardrailControl, { readonly kind: "confidence" }>,
  context: GuardrailContext,
): FailedControl[] {
  if (context.confidence === undefined) {
    return [
      {
        disposition: control.onFailure,
        reason: {
          code: "CONFIDENCE_REQUIRED",
          control: "confidence",
          message: "Confidence is required by policy but was not provided.",
          details: { minimum: control.atLeast },
        },
      },
    ];
  }

  if (context.confidence < control.atLeast) {
    return [
      {
        disposition: control.onFailure,
        reason: {
          code: "CONFIDENCE_BELOW_THRESHOLD",
          control: "confidence",
          message: "Confidence is below the minimum required by policy.",
          details: {
            actual: context.confidence,
            minimum: control.atLeast,
          },
        },
      },
    ];
  }

  return [];
}

/** Evaluates action risk against the maximum risk accepted by policy. */
function evaluateRisk(
  control: Extract<GuardrailControl, { readonly kind: "risk" }>,
  context: GuardrailContext,
): FailedControl[] {
  if (context.risk === undefined) {
    return [
      {
        disposition: control.onFailure,
        reason: {
          code: "RISK_REQUIRED",
          control: "risk",
          message: "Risk classification is required by policy but was not provided.",
          details: { maximum: control.atMost },
        },
      },
    ];
  }

  if (RISK_RANK[context.risk] > RISK_RANK[control.atMost]) {
    return [
      {
        disposition: control.onFailure,
        reason: {
          code: "RISK_EXCEEDS_MAXIMUM",
          control: "risk",
          message: "Action risk exceeds the maximum accepted by policy.",
          details: {
            actual: context.risk,
            maximum: control.atMost,
          },
        },
      },
    ];
  }

  return [];
}

/** Evaluates whether reversibility matches the explicit policy requirement. */
function evaluateReversibility(
  control: Extract<GuardrailControl, { readonly kind: "reversibility" }>,
  context: GuardrailContext,
): FailedControl[] {
  if (context.reversible === undefined) {
    return [
      {
        disposition: control.onFailure,
        reason: {
          code: "REVERSIBILITY_REQUIRED",
          control: "reversibility",
          message: "Reversibility must be known before this action can pass policy.",
          details: { required: control.mustBe },
        },
      },
    ];
  }

  if (context.reversible !== control.mustBe) {
    return [
      {
        disposition: control.onFailure,
        reason: {
          code: "REVERSIBILITY_MISMATCH",
          control: "reversibility",
          message: "Action reversibility does not satisfy policy.",
          details: {
            actual: context.reversible,
            required: control.mustBe,
          },
        },
      },
    ];
  }

  return [];
}

/** Evaluates provider limitations that explicitly block this action. */
function evaluateProviderConstraints(
  control: Extract<GuardrailControl, { readonly kind: "provider_constraints" }>,
  context: GuardrailContext,
): FailedControl[] {
  const active = new Set(context.providerConstraints ?? []);
  const forbiddenPresent = control.noneOf.filter((constraint) => active.has(constraint));

  if (forbiddenPresent.length === 0) {
    return [];
  }

  return [
    {
      disposition: control.onFailure,
      reason: {
        code: "PROVIDER_CONSTRAINT_FORBIDDEN",
        control: "provider_constraints",
        message: "An active provider constraint prevents this action from passing policy.",
        details: { forbiddenPresent },
      },
    },
  ];
}

/** Evaluates a generic application setting without echoing its value in output. */
function evaluateSetting(
  control: Extract<GuardrailControl, { readonly kind: "setting" }>,
  context: GuardrailContext,
): FailedControl[] {
  const settings = context.settings;

  if (settings === undefined || !Object.hasOwn(settings, control.key)) {
    return [
      {
        disposition: control.onFailure,
        reason: {
          code: "SETTING_REQUIRED",
          control: "setting",
          message: `Required setting "${control.key}" was not provided.`,
          details: { key: control.key },
        },
      },
    ];
  }

  if (!Object.is(settings[control.key], control.equals)) {
    return [
      {
        disposition: control.onFailure,
        reason: {
          code: "SETTING_MISMATCH",
          control: "setting",
          message: `Setting "${control.key}" does not satisfy policy.`,
          details: { key: control.key },
        },
      },
    ];
  }

  return [];
}

/** Evaluates a single typed control. */
function evaluateControl(
  control: GuardrailControl,
  context: GuardrailContext,
): FailedControl[] {
  switch (control.kind) {
    case "permissions":
      return evaluatePermissions(control, context);
    case "confidence":
      return evaluateConfidence(control, context);
    case "risk":
      return evaluateRisk(control, context);
    case "reversibility":
      return evaluateReversibility(control, context);
    case "provider_constraints":
      return evaluateProviderConstraints(control, context);
    case "setting":
      return evaluateSetting(control, context);
    default: {
      const exhaustive: never = control;
      return exhaustive;
    }
  }
}

/** Returns the safest explicit failure outcome represented by failed controls. */
function resolveFailureDisposition(
  failures: readonly FailedControl[],
): FailureDisposition {
  return failures.some((failure) => failure.disposition === "escalate")
    ? "escalate"
    : "request_approval";
}

/**
 * Evaluates one context against one exact action policy.
 *
 * @throws GuardrailValidationError when policy or context is malformed.
 * @throws Error when the supplied policy and context refer to different actions.
 */
export function evaluatePolicy(
  policy: GuardrailPolicy,
  context: GuardrailContext,
): GuardrailDecision {
  validatePolicy(policy);
  validateContext(context);

  if (policy.action !== context.action) {
    throw new Error(
      `Policy action "${policy.action}" cannot evaluate context action "${context.action}".`,
    );
  }

  const controlFailures = policy.controls.map((control) =>
    evaluateControl(control, context),
  );
  const failures = controlFailures.flat();

  const disposition =
    failures.length === 0 ? policy.onPass : resolveFailureDisposition(failures);

  const reasons: readonly GuardrailReason[] =
    failures.length === 0
      ? [
          {
            code: "POLICY_PASSED",
            message: "All policy controls passed.",
          },
        ]
      : failures.map((failure) => failure.reason);

  return {
    action: context.action,
    matchedPolicy: true,
    policyId: policy.id,
    disposition,
    canExecute: disposition === "execute",
    requiresHuman:
      disposition === "request_approval" || disposition === "escalate",
    controlsEvaluated: policy.controls.length,
    controlsFailed: controlFailures.filter((controlFailure) => controlFailure.length > 0).length,
    reasons,
  };
}
