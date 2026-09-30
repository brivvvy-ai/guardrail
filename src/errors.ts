/**
 * =============================================================================
 * Brivvvy
 * -----------------------------------------------------------------------------
 * File:
 * errors.ts
 *
 * Purpose
 * -----------------------------------------------------------------------------
 * Defines explicit error classes for invalid Guardrail configuration and input.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Distinguish validation failures from registry conflicts
 * • Preserve actionable validation issues without exposing secrets
 * • Avoid silently accepting ambiguous policy configuration
 *
 * Architectural Role
 * -----------------------------------------------------------------------------
 * Layer:
 *   Domain Errors
 *
 * Consumes:
 *   • Standard Error
 *
 * Produces:
 *   • Public Guardrail error classes
 *
 * Design Philosophy
 * -----------------------------------------------------------------------------
 * Configuration defects fail loudly. Policy outcomes do not throw; they return
 * structured decisions. This keeps operational decisions separate from
 * programmer/configuration errors.
 *
 * Dependencies
 * -----------------------------------------------------------------------------
 * • None
 *
 * Future Enhancements
 * -----------------------------------------------------------------------------
 * □ Stable numeric error identifiers if ecosystem integrations require them
 *
 * =============================================================================
 */

/** Base class for errors produced by Guardrail itself. */
export class GuardrailError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Raised when a policy or evaluation context is structurally invalid. */
export class GuardrailValidationError extends GuardrailError {
  public readonly issues: readonly string[];

  public constructor(message: string, issues: readonly string[]) {
    super(message);
    this.issues = [...issues];
  }
}

/** Raised when registry configuration would make policy selection ambiguous. */
export class GuardrailConfigurationError extends GuardrailError {}
