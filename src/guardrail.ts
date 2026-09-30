/**
 * =============================================================================
 * Brivvvy
 * -----------------------------------------------------------------------------
 * File:
 * guardrail.ts
 *
 * Purpose
 * -----------------------------------------------------------------------------
 * Creates an exact-action policy registry and exposes the primary Guardrail API.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Validate registry configuration eagerly
 * • Enforce one deterministic policy per exact action
 * • Fail closed when no policy exists
 * • Delegate matched-policy decisions to the pure evaluator
 *
 * Architectural Role
 * -----------------------------------------------------------------------------
 * Layer:
 *   Public Runtime Facade
 *
 * Consumes:
 *   • GuardrailOptions
 *   • GuardrailContext
 *
 * Produces:
 *   • Guardrail runtime instance
 *
 * Design Philosophy
 * -----------------------------------------------------------------------------
 * A missing or ambiguous policy must never silently authorize execution.
 * Registry behavior is synchronous, deterministic, side-effect free, and does
 * not log caller data.
 *
 * Dependencies
 * -----------------------------------------------------------------------------
 * • evaluatePolicy()
 * • Policy and context validation
 *
 * Future Enhancements
 * -----------------------------------------------------------------------------
 * □ Explicit versioned policy bundles
 *
 * =============================================================================
 */

import { GuardrailConfigurationError } from "./errors.js";
import { evaluatePolicy } from "./evaluate.js";
import {
  type Guardrail,
  type GuardrailContext,
  type GuardrailDecision,
  type GuardrailOptions,
  type GuardrailPolicy,
} from "./types.js";
import { validateContext, validatePolicy } from "./validation.js";

/** Creates a fail-closed decision when no exact policy matches an action. */
function createMissingPolicyDecision(
  context: GuardrailContext,
  disposition: "request_approval" | "escalate",
): GuardrailDecision {
  return {
    action: context.action,
    matchedPolicy: false,
    policyId: null,
    disposition,
    canExecute: false,
    requiresHuman: true,
    controlsEvaluated: 0,
    controlsFailed: 0,
    reasons: [
      {
        code: "POLICY_NOT_FOUND",
        message: "No policy is registered for this action. Guardrail failed closed.",
      },
    ],
  };
}

/**
 * Creates a deterministic Guardrail policy registry.
 *
 * @throws GuardrailValidationError for malformed policies.
 * @throws GuardrailConfigurationError for duplicate IDs or action mappings.
 */
export function createGuardrail(options: GuardrailOptions): Guardrail {
  const missingPolicyDisposition = options.missingPolicyDisposition ?? "escalate";

  if (
    missingPolicyDisposition !== "request_approval" &&
    missingPolicyDisposition !== "escalate"
  ) {
    throw new GuardrailConfigurationError(
      "missingPolicyDisposition must be request_approval or escalate.",
    );
  }

  const byAction = new Map<string, GuardrailPolicy>();
  const ids = new Set<string>();

  for (const policy of options.policies) {
    validatePolicy(policy);

    if (ids.has(policy.id)) {
      throw new GuardrailConfigurationError(
        `Duplicate Guardrail policy id: "${policy.id}".`,
      );
    }

    if (byAction.has(policy.action)) {
      throw new GuardrailConfigurationError(
        `Multiple Guardrail policies target action "${policy.action}". v0.1 requires exactly one policy per action.`,
      );
    }

    ids.add(policy.id);
    byAction.set(policy.action, policy);
  }

  const policySnapshot = Object.freeze([...options.policies]);

  return {
    evaluate(context: GuardrailContext): GuardrailDecision {
      validateContext(context);
      const policy = byAction.get(context.action);

      if (policy === undefined) {
        return createMissingPolicyDecision(context, missingPolicyDisposition);
      }

      return evaluatePolicy(policy, context);
    },

    getPolicy(action: string): GuardrailPolicy | undefined {
      return byAction.get(action);
    },

    listPolicies(): readonly GuardrailPolicy[] {
      return policySnapshot;
    },
  };
}
