/**
 * =============================================================================
 * Brivvvy
 * -----------------------------------------------------------------------------
 * File:
 * index.ts
 *
 * Purpose
 * -----------------------------------------------------------------------------
 * Defines the stable public export surface for @brivvvy/guardrail.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Export public runtime helpers
 * • Export public errors and domain contracts
 * • Keep internal implementation details private by default
 *
 * Architectural Role
 * -----------------------------------------------------------------------------
 * Layer:
 *   Public Package Boundary
 *
 * Consumes:
 *   • Guardrail public modules
 *
 * Produces:
 *   • Package API
 *
 * Design Philosophy
 * -----------------------------------------------------------------------------
 * Consumers should be able to rely on this file rather than internal paths.
 *
 * Dependencies
 * -----------------------------------------------------------------------------
 * • Public Guardrail modules
 *
 * Future Enhancements
 * -----------------------------------------------------------------------------
 * □ Additional exports only when they represent durable public contracts
 *
 * =============================================================================
 */

export {
  GuardrailConfigurationError,
  GuardrailError,
  GuardrailValidationError,
} from "./errors.js";
export { evaluatePolicy } from "./evaluate.js";
export { createGuardrail } from "./guardrail.js";
export { definePolicy } from "./policy.js";
export {
  GUARDRAIL_DISPOSITIONS,
  RISK_LEVELS,
  type ConfidenceControl,
  type FailureDisposition,
  type Guardrail,
  type GuardrailContext,
  type GuardrailControl,
  type GuardrailDecision,
  type GuardrailDisposition,
  type GuardrailOptions,
  type GuardrailPolicy,
  type GuardrailPrimitive,
  type GuardrailReason,
  type GuardrailReasonCode,
  type GuardrailReasonDetail,
  type PermissionControl,
  type ProviderConstraintControl,
  type ReversibilityControl,
  type RiskControl,
  type RiskLevel,
  type SettingControl,
} from "./types.js";
