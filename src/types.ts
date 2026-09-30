/**
 * =============================================================================
 * Brivvvy
 * -----------------------------------------------------------------------------
 * File:
 * types.ts
 *
 * Purpose
 * -----------------------------------------------------------------------------
 * Defines the public domain vocabulary for deterministic guarded-autonomy
 * policy evaluation.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Define risk, disposition, control, context, policy, and decision contracts
 * • Keep the public API explicit and framework-independent
 * • Prevent policy evaluation from depending on untyped data
 *
 * Architectural Role
 * -----------------------------------------------------------------------------
 * Layer:
 *   Domain Types
 *
 * Consumes:
 *   • No runtime dependencies
 *
 * Produces:
 *   • Public TypeScript contracts used throughout Guardrail
 *
 * Design Philosophy
 * -----------------------------------------------------------------------------
 * These types describe the policy domain rather than any UI, model provider,
 * agent framework, or Brivvvy-internal business logic.
 *
 * Dependencies
 * -----------------------------------------------------------------------------
 * • None
 *
 * Future Enhancements
 * -----------------------------------------------------------------------------
 * □ Versioned policy serialization format
 * □ Optional policy composition primitives
 *
 * =============================================================================
 */

/** Risk categories ordered from least to most consequential. */
export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

/** A normalized risk classification understood by the policy engine. */
export type RiskLevel = (typeof RISK_LEVELS)[number];

/**
 * Guarded-autonomy vocabulary used by Guardrail decisions.
 *
 * The values intentionally describe what may happen next; Guardrail itself
 * never performs the action.
 */
export const GUARDRAIL_DISPOSITIONS = [
  "observe",
  "recommend",
  "draft",
  "request_approval",
  "execute",
  "escalate",
] as const;

/** The next permitted autonomy state for an evaluated action. */
export type GuardrailDisposition = (typeof GUARDRAIL_DISPOSITIONS)[number];

/**
 * Safe outcomes available when a policy control fails.
 *
 * A failed control may require human approval or require escalation. It may not
 * silently increase autonomy.
 */
export type FailureDisposition = "request_approval" | "escalate";

/** Primitive value supported by generic policy settings. */
export type GuardrailPrimitive = string | number | boolean | null;

/** Permission requirements evaluated against the context permission set. */
export interface PermissionControl {
  readonly kind: "permissions";
  readonly allOf?: readonly string[];
  readonly anyOf?: readonly string[];
  readonly noneOf?: readonly string[];
  readonly onFailure: FailureDisposition;
}

/** Minimum normalized confidence required by a policy. */
export interface ConfidenceControl {
  readonly kind: "confidence";
  readonly atLeast: number;
  readonly onFailure: FailureDisposition;
}

/** Maximum acceptable risk for the policy. */
export interface RiskControl {
  readonly kind: "risk";
  readonly atMost: RiskLevel;
  readonly onFailure: FailureDisposition;
}

/** Required reversibility state for an action. */
export interface ReversibilityControl {
  readonly kind: "reversibility";
  readonly mustBe: boolean;
  readonly onFailure: FailureDisposition;
}

/** Provider constraints that must not be active for the action to pass. */
export interface ProviderConstraintControl {
  readonly kind: "provider_constraints";
  readonly noneOf: readonly string[];
  readonly onFailure: FailureDisposition;
}

/** Required caller-supplied setting value. */
export interface SettingControl {
  readonly kind: "setting";
  readonly key: string;
  readonly equals: GuardrailPrimitive;
  readonly onFailure: FailureDisposition;
}

/** A single deterministic control supported in v0.1. */
export type GuardrailControl =
  | PermissionControl
  | ConfidenceControl
  | RiskControl
  | ReversibilityControl
  | ProviderConstraintControl
  | SettingControl;

/**
 * Declarative policy for one exact action identifier.
 *
 * v0.1 deliberately supports one policy per exact action. Wildcards and
 * implicit precedence are excluded to keep evaluation predictable.
 */
export interface GuardrailPolicy {
  readonly id: string;
  readonly action: string;
  readonly description: string;
  readonly controls: readonly GuardrailControl[];
  readonly onPass: GuardrailDisposition;
}

/** Runtime facts supplied when an action is evaluated. */
export interface GuardrailContext {
  readonly action: string;
  readonly confidence?: number;
  readonly risk?: RiskLevel;
  readonly reversible?: boolean;
  readonly permissions?: readonly string[];
  readonly providerConstraints?: readonly string[];
  readonly settings?: Readonly<Record<string, GuardrailPrimitive>>;
}

/** Stable reason codes intended for programmatic handling and audit output. */
export type GuardrailReasonCode =
  | "POLICY_PASSED"
  | "POLICY_NOT_FOUND"
  | "PERMISSION_ALL_OF_MISSING"
  | "PERMISSION_ANY_OF_MISSING"
  | "PERMISSION_FORBIDDEN_PRESENT"
  | "CONFIDENCE_REQUIRED"
  | "CONFIDENCE_BELOW_THRESHOLD"
  | "RISK_REQUIRED"
  | "RISK_EXCEEDS_MAXIMUM"
  | "REVERSIBILITY_REQUIRED"
  | "REVERSIBILITY_MISMATCH"
  | "PROVIDER_CONSTRAINT_FORBIDDEN"
  | "SETTING_REQUIRED"
  | "SETTING_MISMATCH";

/** Safe structured value permitted in explanation details. */
export type GuardrailReasonDetail = GuardrailPrimitive | readonly string[];

/** Machine-readable, human-understandable explanation for a decision. */
export interface GuardrailReason {
  readonly code: GuardrailReasonCode;
  readonly message: string;
  readonly control?: GuardrailControl["kind"];
  readonly details?: Readonly<Record<string, GuardrailReasonDetail>>;
}

/** Complete deterministic result of one policy evaluation. */
export interface GuardrailDecision {
  readonly action: string;
  readonly matchedPolicy: boolean;
  readonly policyId: string | null;
  readonly disposition: GuardrailDisposition;
  readonly canExecute: boolean;
  readonly requiresHuman: boolean;
  readonly controlsEvaluated: number;
  readonly controlsFailed: number;
  readonly reasons: readonly GuardrailReason[];
}

/** Configuration for a Guardrail registry instance. */
export interface GuardrailOptions {
  readonly policies: readonly GuardrailPolicy[];
  readonly missingPolicyDisposition?: FailureDisposition;
}

/** Public runtime surface returned by createGuardrail(). */
export interface Guardrail {
  evaluate(context: GuardrailContext): GuardrailDecision;
  getPolicy(action: string): GuardrailPolicy | undefined;
  listPolicies(): readonly GuardrailPolicy[];
}
