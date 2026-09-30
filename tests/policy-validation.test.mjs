/**
 * =============================================================================
 * Brivvvy
 * -----------------------------------------------------------------------------
 * File:
 * policy-validation.test.mjs
 *
 * Purpose
 * -----------------------------------------------------------------------------
 * Verifies runtime policy and context validation boundaries.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Reject malformed policy configuration
 * • Reject unsafe runtime values
 * • Accept valid boundary values
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
 *   • Validation regression coverage
 *
 * Design Philosophy
 * -----------------------------------------------------------------------------
 * Tests assert public outcomes rather than private implementation details.
 *
 * Dependencies
 * -----------------------------------------------------------------------------
 * • node:test
 * • node:assert/strict
 *
 * Future Enhancements
 * -----------------------------------------------------------------------------
 * □ Add serialized-policy fixtures when a public serialization format exists
 *
 * =============================================================================
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GuardrailValidationError,
  createGuardrail,
  definePolicy,
  evaluatePolicy,
} from "../dist/index.js";

const basePolicy = {
  id: "send-message",
  action: "send_external_message",
  description: "Controls external message execution.",
  onPass: "execute",
  controls: [],
};

function expectValidationError(fn) {
  assert.throws(fn, (error) => error instanceof GuardrailValidationError);
}

describe("policy validation", () => {
  it("accepts a minimal valid policy", () => {
    const policy = definePolicy(basePolicy);
    assert.equal(policy, basePolicy);
  });

  it("rejects an empty policy id", () => {
    expectValidationError(() => definePolicy({ ...basePolicy, id: " " }));
  });

  it("rejects an empty action", () => {
    expectValidationError(() => definePolicy({ ...basePolicy, action: "" }));
  });

  it("rejects an empty description", () => {
    expectValidationError(() => definePolicy({ ...basePolicy, description: "   " }));
  });

  it("rejects an unknown onPass disposition", () => {
    expectValidationError(() => definePolicy({ ...basePolicy, onPass: "allow" }));
  });

  it("rejects a permissions control without clauses", () => {
    expectValidationError(() =>
      definePolicy({
        ...basePolicy,
        controls: [{ kind: "permissions", onFailure: "escalate" }],
      }),
    );
  });

  it("rejects an empty permission clause", () => {
    expectValidationError(() =>
      definePolicy({
        ...basePolicy,
        controls: [
          { kind: "permissions", allOf: [], onFailure: "escalate" },
        ],
      }),
    );
  });

  it("rejects blank permission identifiers", () => {
    expectValidationError(() =>
      definePolicy({
        ...basePolicy,
        controls: [
          { kind: "permissions", allOf: ["send", " "], onFailure: "escalate" },
        ],
      }),
    );
  });

  it("rejects duplicate permission identifiers", () => {
    expectValidationError(() =>
      definePolicy({
        ...basePolicy,
        controls: [
          { kind: "permissions", allOf: ["send", "send"], onFailure: "escalate" },
        ],
      }),
    );
  });

  for (const value of [-0.01, 1.01, Number.NaN, Number.POSITIVE_INFINITY]) {
    it(`rejects invalid confidence threshold ${String(value)}`, () => {
      expectValidationError(() =>
        definePolicy({
          ...basePolicy,
          controls: [
            { kind: "confidence", atLeast: value, onFailure: "request_approval" },
          ],
        }),
      );
    });
  }

  it("accepts confidence threshold zero", () => {
    assert.doesNotThrow(() =>
      definePolicy({
        ...basePolicy,
        controls: [
          { kind: "confidence", atLeast: 0, onFailure: "request_approval" },
        ],
      }),
    );
  });

  it("accepts confidence threshold one", () => {
    assert.doesNotThrow(() =>
      definePolicy({
        ...basePolicy,
        controls: [
          { kind: "confidence", atLeast: 1, onFailure: "request_approval" },
        ],
      }),
    );
  });

  it("rejects an unknown risk threshold", () => {
    expectValidationError(() =>
      definePolicy({
        ...basePolicy,
        controls: [{ kind: "risk", atMost: "extreme", onFailure: "escalate" }],
      }),
    );
  });

  it("rejects an empty provider-constraint list", () => {
    expectValidationError(() =>
      definePolicy({
        ...basePolicy,
        controls: [
          { kind: "provider_constraints", noneOf: [], onFailure: "escalate" },
        ],
      }),
    );
  });

  it("rejects a blank setting key", () => {
    expectValidationError(() =>
      definePolicy({
        ...basePolicy,
        controls: [
          { kind: "setting", key: " ", equals: true, onFailure: "request_approval" },
        ],
      }),
    );
  });

  it("rejects non-finite numeric setting values", () => {
    expectValidationError(() =>
      definePolicy({
        ...basePolicy,
        controls: [
          { kind: "setting", key: "enabled", equals: Number.NaN, onFailure: "request_approval" },
        ],
      }),
    );
  });

  it("rejects unsupported failure dispositions", () => {
    expectValidationError(() =>
      definePolicy({
        ...basePolicy,
        controls: [
          { kind: "confidence", atLeast: 0.5, onFailure: "execute" },
        ],
      }),
    );
  });
});

describe("context validation", () => {
  it("rejects an empty action", () => {
    const guardrail = createGuardrail({ policies: [basePolicy] });
    expectValidationError(() => guardrail.evaluate({ action: "" }));
  });

  for (const value of [-0.1, 1.1, Number.NaN, Number.NEGATIVE_INFINITY]) {
    it(`rejects invalid context confidence ${String(value)}`, () => {
      expectValidationError(() =>
        evaluatePolicy(basePolicy, {
          action: basePolicy.action,
          confidence: value,
        }),
      );
    });
  }

  it("rejects an unknown context risk", () => {
    expectValidationError(() =>
      evaluatePolicy(basePolicy, {
        action: basePolicy.action,
        risk: "extreme",
      }),
    );
  });

  it("rejects duplicate context permissions", () => {
    expectValidationError(() =>
      evaluatePolicy(basePolicy, {
        action: basePolicy.action,
        permissions: ["send", "send"],
      }),
    );
  });

  it("rejects duplicate provider constraints", () => {
    expectValidationError(() =>
      evaluatePolicy(basePolicy, {
        action: basePolicy.action,
        providerConstraints: ["offline", "offline"],
      }),
    );
  });

  it("accepts primitive settings including null", () => {
    assert.doesNotThrow(() =>
      evaluatePolicy(basePolicy, {
        action: basePolicy.action,
        settings: {
          enabled: true,
          retries: 2,
          mode: "safe",
          unset: null,
        },
      }),
    );
  });
});
