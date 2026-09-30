/**
 * =============================================================================
 * Brivvvy
 * -----------------------------------------------------------------------------
 * File:
 * quick-start.ts
 *
 * Purpose
 * -----------------------------------------------------------------------------
 * Demonstrates the smallest useful Guardrail policy and evaluation flow.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Show policy definition
 * • Show registry creation
 * • Show a guarded decision without performing the action
 *
 * Architectural Role
 * -----------------------------------------------------------------------------
 * Layer:
 *   Public Example
 *
 * Consumes:
 *   • @brivvvy/guardrail public API
 *
 * Produces:
 *   • Example decision output
 *
 * Design Philosophy
 * -----------------------------------------------------------------------------
 * Examples remain generic and contain no Brivvvy product internals, credentials,
 * customer data, private prompts, or proprietary policy values.
 *
 * Dependencies
 * -----------------------------------------------------------------------------
 * • @brivvvy/guardrail
 *
 * Future Enhancements
 * -----------------------------------------------------------------------------
 * □ Add framework-specific examples only when they demonstrate durable patterns
 *
 * =============================================================================
 */

import { createGuardrail, definePolicy } from "../src/index.js";

const sendExternalMessage = definePolicy({
  id: "send-external-message",
  action: "send_external_message",
  description: "Allow execution only when explicit safety controls pass.",
  onPass: "execute",
  controls: [
    {
      kind: "permissions",
      allOf: ["message:send"],
      onFailure: "escalate",
    },
    {
      kind: "confidence",
      atLeast: 0.95,
      onFailure: "request_approval",
    },
    {
      kind: "risk",
      atMost: "low",
      onFailure: "request_approval",
    },
    {
      kind: "reversibility",
      mustBe: true,
      onFailure: "request_approval",
    },
  ],
});

const guardrail = createGuardrail({
  policies: [sendExternalMessage],
});

const decision = guardrail.evaluate({
  action: "send_external_message",
  permissions: ["message:send"],
  confidence: 0.91,
  risk: "low",
  reversible: true,
});

console.log(decision);
