/**
 * =============================================================================
 * Brivvvy
 * -----------------------------------------------------------------------------
 * File:
 * guardrail.test.mjs
 *
 * Purpose
 * -----------------------------------------------------------------------------
 * Verifies registry, missing-policy, and public decision behavior.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Verify exact-action routing
 * • Verify fail-closed defaults
 * • Reject ambiguous registry configuration
 * • Verify public decision convenience fields
 *
 * Architectural Role
 * -----------------------------------------------------------------------------
 * Layer:
 *   Behavioral Tests
 *
 * Consumes:
 *   • Public @brivvvy/guardrail build output
 *
 * Produces:
 *   • Runtime facade regression coverage
 *
 * Design Philosophy
 * -----------------------------------------------------------------------------
 * Registry ambiguity is a configuration error; missing policy is an operational
 * decision and therefore fails closed without throwing.
 *
 * Dependencies
 * -----------------------------------------------------------------------------
 * • node:test
 * • node:assert/strict
 *
 * Future Enhancements
 * -----------------------------------------------------------------------------
 * □ Add policy-bundle versioning scenarios when supported
 *
 * =============================================================================
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GuardrailConfigurationError,
  createGuardrail,
  evaluatePolicy,
} from "../dist/index.js";

const executePolicy = {
  id: "execute-action",
  action: "action.execute",
  description: "Allows a low-risk action when controls pass.",
  onPass: "execute",
  controls: [],
};

const draftPolicy = {
  id: "draft-action",
  action: "action.draft",
  description: "Classifies a safe successful action as draft-only.",
  onPass: "draft",
  controls: [],
};

describe("createGuardrail", () => {
  it("routes an action to its exact policy", () => {
    const guardrail = createGuardrail({ policies: [executePolicy, draftPolicy] });
    const decision = guardrail.evaluate({ action: "action.draft" });
    assert.equal(decision.policyId, "draft-action");
    assert.equal(decision.disposition, "draft");
  });

  it("fails closed with escalation when policy is missing", () => {
    const guardrail = createGuardrail({ policies: [executePolicy] });
    const decision = guardrail.evaluate({ action: "unknown" });
    assert.equal(decision.matchedPolicy, false);
    assert.equal(decision.disposition, "escalate");
    assert.equal(decision.canExecute, false);
    assert.equal(decision.requiresHuman, true);
    assert.deepEqual(decision.reasons.map((reason) => reason.code), ["POLICY_NOT_FOUND"]);
  });

  it("can fail closed to request approval when explicitly configured", () => {
    const guardrail = createGuardrail({
      policies: [],
      missingPolicyDisposition: "request_approval",
    });
    const decision = guardrail.evaluate({ action: "unknown" });
    assert.equal(decision.disposition, "request_approval");
  });

  it("rejects an invalid missing-policy disposition", () => {
    assert.throws(
      () => createGuardrail({ policies: [], missingPolicyDisposition: "execute" }),
      GuardrailConfigurationError,
    );
  });

  it("rejects duplicate policy ids", () => {
    assert.throws(
      () =>
        createGuardrail({
          policies: [executePolicy, { ...draftPolicy, id: executePolicy.id }],
        }),
      GuardrailConfigurationError,
    );
  });

  it("rejects multiple policies for the same action", () => {
    assert.throws(
      () =>
        createGuardrail({
          policies: [executePolicy, { ...draftPolicy, action: executePolicy.action }],
        }),
      GuardrailConfigurationError,
    );
  });

  it("returns a policy by exact action", () => {
    const guardrail = createGuardrail({ policies: [executePolicy] });
    assert.equal(guardrail.getPolicy(executePolicy.action), executePolicy);
    assert.equal(guardrail.getPolicy("missing"), undefined);
  });

  it("lists configured policies in registration order", () => {
    const guardrail = createGuardrail({ policies: [executePolicy, draftPolicy] });
    assert.deepEqual(guardrail.listPolicies(), [executePolicy, draftPolicy]);
  });

  it("returns a frozen policy-list snapshot", () => {
    const guardrail = createGuardrail({ policies: [executePolicy] });
    assert.equal(Object.isFrozen(guardrail.listPolicies()), true);
  });
});

describe("decision convenience fields", () => {
  for (const [disposition, canExecute, requiresHuman] of [
    ["observe", false, false],
    ["recommend", false, false],
    ["draft", false, false],
    ["request_approval", false, true],
    ["execute", true, false],
    ["escalate", false, true],
  ]) {
    it(`derives flags correctly for ${disposition}`, () => {
      const decision = evaluatePolicy(
        {
          id: `policy-${disposition}`,
          action: "action",
          description: "Disposition flag test.",
          onPass: disposition,
          controls: [],
        },
        { action: "action" },
      );
      assert.equal(decision.canExecute, canExecute);
      assert.equal(decision.requiresHuman, requiresHuman);
    });
  }

  it("throws when evaluatePolicy receives a mismatched action", () => {
    assert.throws(() => evaluatePolicy(executePolicy, { action: "different" }));
  });
});
