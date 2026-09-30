/**
 * =============================================================================
 * Brivvvy
 * -----------------------------------------------------------------------------
 * File:
 * policy.ts
 *
 * Purpose
 * -----------------------------------------------------------------------------
 * Provides the public policy-definition helper for validated Guardrail policies.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Validate policy configuration at definition time
 * • Return the original strongly typed policy without hidden transformation
 * • Keep policy authoring ergonomic and explicit
 *
 * Architectural Role
 * -----------------------------------------------------------------------------
 * Layer:
 *   Domain Policy Definition
 *
 * Consumes:
 *   • GuardrailPolicy
 *
 * Produces:
 *   • Validated GuardrailPolicy
 *
 * Design Philosophy
 * -----------------------------------------------------------------------------
 * definePolicy() is intentionally boring: it validates and returns. It does not
 * mutate values, infer thresholds, reorder controls, or add secret defaults.
 *
 * Dependencies
 * -----------------------------------------------------------------------------
 * • validatePolicy()
 *
 * Future Enhancements
 * -----------------------------------------------------------------------------
 * □ Optional immutable policy compilation if profiling demonstrates value
 *
 * =============================================================================
 */

import type { GuardrailPolicy } from "./types.js";
import { validatePolicy } from "./validation.js";

/**
 * Validates and returns a declarative Guardrail policy.
 *
 * @example
 * ```ts
 * const policy = definePolicy({
 *   id: "send-message",
 *   action: "send_external_message",
 *   description: "Gate external messages.",
 *   onPass: "execute",
 *   controls: [],
 * });
 * ```
 */
export function definePolicy<const TPolicy extends GuardrailPolicy>(
  policy: TPolicy,
): TPolicy {
  validatePolicy(policy);
  return policy;
}
