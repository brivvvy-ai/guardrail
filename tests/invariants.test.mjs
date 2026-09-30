/**
 * =============================================================================
 * Brivvvy
 * -----------------------------------------------------------------------------
 * File:
 * invariants.test.mjs
 *
 * Purpose
 * -----------------------------------------------------------------------------
 * Verifies deterministic and safety invariants across decision matrices.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Verify risk ordering exhaustively
 * • Verify confidence boundary behavior
 * • Verify deterministic repeated evaluation
 * • Verify the engine does not mutate caller-owned values
 *
 * Architectural Role
 * -----------------------------------------------------------------------------
 * Layer:
 *   Behavioral / Invariant Tests
 *
 * Consumes:
 *   • Public @brivvvy/guardrail build output
 *
 * Produces:
 *   • Cross-cutting safety regression coverage
 *
 * Design Philosophy
 * -----------------------------------------------------------------------------
 * Invariants protect the policy model from regressions that individual examples
 * may not expose.
 *
 * Dependencies
 * -----------------------------------------------------------------------------
 * • node:test
 * • node:assert/strict
 *
 * Future Enhancements
 * -----------------------------------------------------------------------------
 * □ Property-based generation if introduced without compromising determinism
 *
 * =============================================================================
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluatePolicy } from "../dist/index.js";

const risks = ["low", "medium", "high", "critical"];

function riskPolicy(maximum) {
  return {
    id: `risk-${maximum}`,
    action: "risk.action",
    description: "Risk ordering invariant.",
    onPass: "execute",
    controls: [
      { kind: "risk", atMost: maximum, onFailure: "request_approval" },
    ],
  };
}

describe("risk ordering invariant", () => {
  risks.forEach((maximum, maximumIndex) => {
    risks.forEach((actual, actualIndex) => {
      it(`${actual} against ${maximum} is ${actualIndex <= maximumIndex ? "allowed" : "guarded"}`, () => {
        const decision = evaluatePolicy(riskPolicy(maximum), {
          action: "risk.action",
          risk: actual,
        });
        assert.equal(
          decision.disposition,
          actualIndex <= maximumIndex ? "execute" : "request_approval",
        );
      });
    });
  });
});

describe("confidence invariant", () => {
  const policy = {
    id: "confidence",
    action: "confidence.action",
    description: "Confidence boundary invariant.",
    onPass: "execute",
    controls: [
      { kind: "confidence", atLeast: 0.75, onFailure: "request_approval" },
    ],
  };

  for (const value of [0, 0.1, 0.5, 0.749999]) {
    it(`guards confidence ${value}`, () => {
      const decision = evaluatePolicy(policy, {
        action: policy.action,
        confidence: value,
      });
      assert.equal(decision.disposition, "request_approval");
    });
  }

  for (const value of [0.75, 0.750001, 0.9, 1]) {
    it(`passes confidence ${value}`, () => {
      const decision = evaluatePolicy(policy, {
        action: policy.action,
        confidence: value,
      });
      assert.equal(decision.disposition, "execute");
    });
  }
});

describe("determinism and mutation invariants", () => {
  const policy = {
    id: "determinism",
    action: "determinism.action",
    description: "Determinism invariant.",
    onPass: "execute",
    controls: [
      { kind: "permissions", allOf: ["execute"], onFailure: "escalate" },
      { kind: "confidence", atLeast: 0.8, onFailure: "request_approval" },
      { kind: "risk", atMost: "medium", onFailure: "request_approval" },
      { kind: "reversibility", mustBe: true, onFailure: "request_approval" },
      { kind: "provider_constraints", noneOf: ["read_only"], onFailure: "escalate" },
      { kind: "setting", key: "enabled", equals: true, onFailure: "request_approval" },
    ],
  };

  const context = {
    action: policy.action,
    permissions: ["execute"],
    confidence: 0.92,
    risk: "low",
    reversible: true,
    providerConstraints: [],
    settings: { enabled: true },
  };

  it("returns deep-equal results across repeated evaluation", () => {
    const first = evaluatePolicy(policy, context);
    const second = evaluatePolicy(policy, context);
    assert.deepEqual(first, second);
  });

  it("does not mutate the policy", () => {
    const before = structuredClone(policy);
    evaluatePolicy(policy, context);
    assert.deepEqual(policy, before);
  });

  it("does not mutate the context", () => {
    const before = structuredClone(context);
    evaluatePolicy(policy, context);
    assert.deepEqual(context, before);
  });

  it("never returns canExecute true for approval", () => {
    const decision = evaluatePolicy(
      {
        ...policy,
        controls: [
          { kind: "confidence", atLeast: 1, onFailure: "request_approval" },
        ],
      },
      { action: policy.action, confidence: 0.9 },
    );
    assert.equal(decision.disposition, "request_approval");
    assert.equal(decision.canExecute, false);
  });

  it("never returns canExecute true for escalation", () => {
    const decision = evaluatePolicy(
      {
        ...policy,
        controls: [
          { kind: "permissions", allOf: ["missing"], onFailure: "escalate" },
        ],
      },
      { action: policy.action, permissions: [] },
    );
    assert.equal(decision.disposition, "escalate");
    assert.equal(decision.canExecute, false);
  });
});
