/**
 * =============================================================================
 * Brivvvy
 * -----------------------------------------------------------------------------
 * File:
 * validation.ts
 *
 * Purpose
 * -----------------------------------------------------------------------------
 * Performs runtime validation for Guardrail policies and evaluation contexts.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Validate externally supplied policy configuration
 * • Validate runtime evaluation context before policy processing
 * • Reject ambiguous or malformed values deterministically
 *
 * Architectural Role
 * -----------------------------------------------------------------------------
 * Layer:
 *   Domain Validation
 *
 * Consumes:
 *   • Guardrail domain types
 *
 * Produces:
 *   • Validated policy and context boundaries
 *
 * Design Philosophy
 * -----------------------------------------------------------------------------
 * TypeScript types do not validate runtime data. Guardrail therefore validates
 * all public runtime entry points before making an autonomy decision.
 *
 * Dependencies
 * -----------------------------------------------------------------------------
 * • GuardrailValidationError
 * • Guardrail domain constants and types
 *
 * Future Enhancements
 * -----------------------------------------------------------------------------
 * □ JSON Schema export once a stable serialization contract is introduced
 *
 * =============================================================================
 */

import { GuardrailValidationError } from "./errors.js";
import {
  GUARDRAIL_DISPOSITIONS,
  RISK_LEVELS,
  type GuardrailContext,
  type GuardrailControl,
  type GuardrailPolicy,
  type GuardrailPrimitive,
} from "./types.js";

/** Returns true when a string contains non-whitespace content. */
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Returns true when a value is a supported Guardrail primitive. */
function isPrimitive(value: unknown): value is GuardrailPrimitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

/** Adds issues for a list that contains invalid or duplicate identifiers. */
function validateIdentifierList(
  label: string,
  values: readonly string[] | undefined,
  issues: string[],
  allowEmpty = false,
): void {
  if (values === undefined) {
    return;
  }

  if (values.length === 0) {
    if (!allowEmpty) {
      issues.push(`${label} must not be empty when provided.`);
    }
    return;
  }

  const normalized = new Set<string>();

  for (const value of values) {
    if (!isNonEmptyString(value)) {
      issues.push(`${label} must contain only non-empty strings.`);
      continue;
    }

    if (normalized.has(value)) {
      issues.push(`${label} must not contain duplicate values.`);
      continue;
    }

    normalized.add(value);
  }
}

/** Validates one policy control and appends all discovered issues. */
function validateControl(
  control: GuardrailControl,
  index: number,
  issues: string[],
): void {
  const label = `controls[${index}]`;

  if (control.onFailure !== "request_approval" && control.onFailure !== "escalate") {
    issues.push(`${label}.onFailure must be request_approval or escalate.`);
  }

  switch (control.kind) {
    case "permissions": {
      const hasClause =
        control.allOf !== undefined ||
        control.anyOf !== undefined ||
        control.noneOf !== undefined;

      if (!hasClause) {
        issues.push(`${label} must define at least one permission clause.`);
      }

      validateIdentifierList(`${label}.allOf`, control.allOf, issues);
      validateIdentifierList(`${label}.anyOf`, control.anyOf, issues);
      validateIdentifierList(`${label}.noneOf`, control.noneOf, issues);
      break;
    }

    case "confidence":
      if (
        !Number.isFinite(control.atLeast) ||
        control.atLeast < 0 ||
        control.atLeast > 1
      ) {
        issues.push(`${label}.atLeast must be a finite number between 0 and 1.`);
      }
      break;

    case "risk":
      if (!RISK_LEVELS.includes(control.atMost)) {
        issues.push(`${label}.atMost must be a recognized risk level.`);
      }
      break;

    case "reversibility":
      if (typeof control.mustBe !== "boolean") {
        issues.push(`${label}.mustBe must be a boolean.`);
      }
      break;

    case "provider_constraints":
      validateIdentifierList(`${label}.noneOf`, control.noneOf, issues);
      break;

    case "setting":
      if (!isNonEmptyString(control.key)) {
        issues.push(`${label}.key must be a non-empty string.`);
      }

      if (!isPrimitive(control.equals)) {
        issues.push(`${label}.equals must be a supported primitive value.`);
      }
      break;

    default: {
      const exhaustive: never = control;
      issues.push(`Unsupported control kind: ${String(exhaustive)}.`);
    }
  }
}

/**
 * Validates a Guardrail policy.
 *
 * @throws GuardrailValidationError when the policy is not safe to evaluate.
 */
export function validatePolicy(policy: GuardrailPolicy): void {
  const issues: string[] = [];

  if (!isNonEmptyString(policy.id)) {
    issues.push("id must be a non-empty string.");
  }

  if (!isNonEmptyString(policy.action)) {
    issues.push("action must be a non-empty string.");
  }

  if (!isNonEmptyString(policy.description)) {
    issues.push("description must be a non-empty string.");
  }

  if (!GUARDRAIL_DISPOSITIONS.includes(policy.onPass)) {
    issues.push("onPass must be a recognized Guardrail disposition.");
  }

  if (!Array.isArray(policy.controls)) {
    issues.push("controls must be an array.");
  } else {
    policy.controls.forEach((control, index) => {
      validateControl(control, index, issues);
    });
  }

  if (issues.length > 0) {
    throw new GuardrailValidationError("Invalid Guardrail policy.", issues);
  }
}

/**
 * Validates runtime evaluation context.
 *
 * @throws GuardrailValidationError when supplied values cannot be evaluated
 * safely or deterministically.
 */
export function validateContext(context: GuardrailContext): void {
  const issues: string[] = [];

  if (!isNonEmptyString(context.action)) {
    issues.push("action must be a non-empty string.");
  }

  if (
    context.confidence !== undefined &&
    (!Number.isFinite(context.confidence) ||
      context.confidence < 0 ||
      context.confidence > 1)
  ) {
    issues.push("confidence must be a finite number between 0 and 1 when provided.");
  }

  if (context.risk !== undefined && !RISK_LEVELS.includes(context.risk)) {
    issues.push("risk must be a recognized risk level when provided.");
  }

  if (context.reversible !== undefined && typeof context.reversible !== "boolean") {
    issues.push("reversible must be a boolean when provided.");
  }

  validateIdentifierList("permissions", context.permissions, issues, true);
  validateIdentifierList("providerConstraints", context.providerConstraints, issues, true);

  if (context.settings !== undefined) {
    for (const [key, value] of Object.entries(context.settings)) {
      if (!isNonEmptyString(key)) {
        issues.push("settings keys must be non-empty strings.");
      }

      if (!isPrimitive(value)) {
        issues.push(`settings.${key} must be a supported primitive value.`);
      }
    }
  }

  if (issues.length > 0) {
    throw new GuardrailValidationError("Invalid Guardrail evaluation context.", issues);
  }
}
