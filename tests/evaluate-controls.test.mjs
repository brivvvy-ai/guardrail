/**
 * =============================================================================
 * Brivvvy
 * -----------------------------------------------------------------------------
 * File:
 * evaluate-controls.test.mjs
 *
 * Purpose
 * -----------------------------------------------------------------------------
 * Verifies behavioral semantics for every v0.1 policy control.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Cover success and failure boundaries
 * • Verify structured reason codes
 * • Verify escalation precedence across simultaneous failures
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
 *   • Control-evaluation regression coverage
 *
 * Design Philosophy
 * -----------------------------------------------------------------------------
 * Every test describes a decision outcome visible to a library consumer.
 *
 * Dependencies
 * -----------------------------------------------------------------------------
 * • node:test
 * • node:assert/strict
 *
 * Future Enhancements
 * -----------------------------------------------------------------------------
 * □ Add serialized fixtures when policy persistence is introduced
 *
 * =============================================================================
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluatePolicy } from "../dist/index.js";

function policyWith(...controls) {
  return {
    id: "policy",
    action: "action",
    description: "Test policy.",
    onPass: "execute",
    controls,
  };
}

function codes(decision) {
  return decision.reasons.map((reason) => reason.code);
}

describe("permission controls", () => {
  it("passes when every allOf permission exists", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "permissions", allOf: ["read", "write"], onFailure: "escalate" }),
      { action: "action", permissions: ["read", "write", "other"] },
    );
    assert.equal(decision.disposition, "execute");
  });

  it("fails when one allOf permission is missing", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "permissions", allOf: ["read", "write"], onFailure: "escalate" }),
      { action: "action", permissions: ["read"] },
    );
    assert.equal(decision.disposition, "escalate");
    assert.deepEqual(codes(decision), ["PERMISSION_ALL_OF_MISSING"]);
    assert.deepEqual(decision.reasons[0].details.missing, ["write"]);
  });

  it("passes anyOf when one permission matches", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "permissions", anyOf: ["admin", "editor"], onFailure: "request_approval" }),
      { action: "action", permissions: ["editor"] },
    );
    assert.equal(decision.disposition, "execute");
  });

  it("fails anyOf when none match", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "permissions", anyOf: ["admin", "editor"], onFailure: "request_approval" }),
      { action: "action", permissions: ["viewer"] },
    );
    assert.equal(decision.disposition, "request_approval");
    assert.deepEqual(codes(decision), ["PERMISSION_ANY_OF_MISSING"]);
  });

  it("passes noneOf when forbidden permissions are absent", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "permissions", noneOf: ["suspended"], onFailure: "escalate" }),
      { action: "action", permissions: ["read"] },
    );
    assert.equal(decision.disposition, "execute");
  });

  it("fails noneOf when a forbidden permission is present", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "permissions", noneOf: ["suspended"], onFailure: "escalate" }),
      { action: "action", permissions: ["read", "suspended"] },
    );
    assert.equal(decision.disposition, "escalate");
    assert.deepEqual(codes(decision), ["PERMISSION_FORBIDDEN_PRESENT"]);
  });

  it("can report multiple failures from one permission control", () => {
    const decision = evaluatePolicy(
      policyWith({
        kind: "permissions",
        allOf: ["write"],
        anyOf: ["owner", "admin"],
        noneOf: ["suspended"],
        onFailure: "escalate",
      }),
      { action: "action", permissions: ["suspended"] },
    );
    assert.equal(decision.controlsEvaluated, 1);
    assert.equal(decision.controlsFailed, 1);
    assert.equal(decision.reasons.length, 3);
    assert.deepEqual(codes(decision), [
      "PERMISSION_ALL_OF_MISSING",
      "PERMISSION_ANY_OF_MISSING",
      "PERMISSION_FORBIDDEN_PRESENT",
    ]);
  });
});

describe("confidence controls", () => {
  it("passes exactly at the threshold", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "confidence", atLeast: 0.9, onFailure: "request_approval" }),
      { action: "action", confidence: 0.9 },
    );
    assert.equal(decision.disposition, "execute");
  });

  it("fails immediately below the threshold", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "confidence", atLeast: 0.9, onFailure: "request_approval" }),
      { action: "action", confidence: 0.899999 },
    );
    assert.equal(decision.disposition, "request_approval");
    assert.deepEqual(codes(decision), ["CONFIDENCE_BELOW_THRESHOLD"]);
  });

  it("fails safely when confidence is unknown", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "confidence", atLeast: 0.9, onFailure: "request_approval" }),
      { action: "action" },
    );
    assert.deepEqual(codes(decision), ["CONFIDENCE_REQUIRED"]);
  });
});

describe("risk controls", () => {
  for (const risk of ["low", "medium"]) {
    it(`passes ${risk} risk when maximum is medium`, () => {
      const decision = evaluatePolicy(
        policyWith({ kind: "risk", atMost: "medium", onFailure: "request_approval" }),
        { action: "action", risk },
      );
      assert.equal(decision.disposition, "execute");
    });
  }

  for (const risk of ["high", "critical"]) {
    it(`fails ${risk} risk when maximum is medium`, () => {
      const decision = evaluatePolicy(
        policyWith({ kind: "risk", atMost: "medium", onFailure: "request_approval" }),
        { action: "action", risk },
      );
      assert.equal(decision.disposition, "request_approval");
      assert.deepEqual(codes(decision), ["RISK_EXCEEDS_MAXIMUM"]);
    });
  }

  it("fails safely when risk is unknown", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "risk", atMost: "low", onFailure: "escalate" }),
      { action: "action" },
    );
    assert.equal(decision.disposition, "escalate");
    assert.deepEqual(codes(decision), ["RISK_REQUIRED"]);
  });
});

describe("reversibility controls", () => {
  it("passes when reversibility matches", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "reversibility", mustBe: true, onFailure: "request_approval" }),
      { action: "action", reversible: true },
    );
    assert.equal(decision.disposition, "execute");
  });

  it("fails when reversibility does not match", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "reversibility", mustBe: true, onFailure: "request_approval" }),
      { action: "action", reversible: false },
    );
    assert.deepEqual(codes(decision), ["REVERSIBILITY_MISMATCH"]);
  });

  it("fails when reversibility is unknown", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "reversibility", mustBe: false, onFailure: "escalate" }),
      { action: "action" },
    );
    assert.deepEqual(codes(decision), ["REVERSIBILITY_REQUIRED"]);
  });
});

describe("provider constraint controls", () => {
  it("passes with no active forbidden constraint", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "provider_constraints", noneOf: ["read_only"], onFailure: "escalate" }),
      { action: "action", providerConstraints: ["rate_limited"] },
    );
    assert.equal(decision.disposition, "execute");
  });

  it("fails when a forbidden provider constraint is active", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "provider_constraints", noneOf: ["read_only"], onFailure: "escalate" }),
      { action: "action", providerConstraints: ["read_only"] },
    );
    assert.deepEqual(codes(decision), ["PROVIDER_CONSTRAINT_FORBIDDEN"]);
  });
});

describe("setting controls", () => {
  for (const value of [true, false, 0, 1, "safe", null]) {
    it(`passes exact setting value ${String(value)}`, () => {
      const decision = evaluatePolicy(
        policyWith({ kind: "setting", key: "mode", equals: value, onFailure: "request_approval" }),
        { action: "action", settings: { mode: value } },
      );
      assert.equal(decision.disposition, "execute");
    });
  }

  it("distinguishes zero from false", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "setting", key: "mode", equals: 0, onFailure: "request_approval" }),
      { action: "action", settings: { mode: false } },
    );
    assert.deepEqual(codes(decision), ["SETTING_MISMATCH"]);
  });

  it("does not echo setting values in mismatch explanations", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "setting", key: "approval_mode", equals: "strict", onFailure: "escalate" }),
      { action: "action", settings: { approval_mode: "unexpected-value" } },
    );
    const serialized = JSON.stringify(decision);
    assert.equal(serialized.includes("unexpected-value"), false);
    assert.equal(serialized.includes("strict"), false);
  });

  it("fails when a required setting is absent", () => {
    const decision = evaluatePolicy(
      policyWith({ kind: "setting", key: "enabled", equals: true, onFailure: "request_approval" }),
      { action: "action", settings: {} },
    );
    assert.deepEqual(codes(decision), ["SETTING_REQUIRED"]);
  });
});

describe("combined controls", () => {
  it("collects every failed control", () => {
    const decision = evaluatePolicy(
      policyWith(
        { kind: "confidence", atLeast: 0.95, onFailure: "request_approval" },
        { kind: "risk", atMost: "low", onFailure: "request_approval" },
        { kind: "reversibility", mustBe: true, onFailure: "request_approval" },
      ),
      { action: "action", confidence: 0.5, risk: "high", reversible: false },
    );
    assert.equal(decision.controlsEvaluated, 3);
    assert.equal(decision.controlsFailed, 3);
    assert.deepEqual(codes(decision), [
      "CONFIDENCE_BELOW_THRESHOLD",
      "RISK_EXCEEDS_MAXIMUM",
      "REVERSIBILITY_MISMATCH",
    ]);
  });

  it("escalation wins when any failed control requires escalation", () => {
    const decision = evaluatePolicy(
      policyWith(
        { kind: "confidence", atLeast: 0.95, onFailure: "request_approval" },
        { kind: "permissions", allOf: ["execute"], onFailure: "escalate" },
      ),
      { action: "action", confidence: 0.2, permissions: [] },
    );
    assert.equal(decision.disposition, "escalate");
  });

  it("returns one POLICY_PASSED reason when every control passes", () => {
    const decision = evaluatePolicy(
      policyWith(
        { kind: "confidence", atLeast: 0.5, onFailure: "request_approval" },
        { kind: "risk", atMost: "medium", onFailure: "request_approval" },
      ),
      { action: "action", confidence: 0.8, risk: "low" },
    );
    assert.deepEqual(codes(decision), ["POLICY_PASSED"]);
    assert.equal(decision.controlsFailed, 0);
  });
});
