import { describe, expect, test } from "bun:test";

import {
  DEFAULT_STRUCTURAL_SCALE_PROPOSAL_CONFIGURATION_V1,
  deriveStructuralScaleProposalV1,
  STRUCTURAL_SCALE_DERIVATION_V1,
} from "../scale-proposal.ts";

describe("structural scale proposal v1", () => {
  test("deterministically proposes a scale when every measured count agrees", () => {
    const input = Object.freeze({ exportCount: 12, fileCount: 20, reuseBreadth: 3 });
    const first = deriveStructuralScaleProposalV1(
      input,
      DEFAULT_STRUCTURAL_SCALE_PROPOSAL_CONFIGURATION_V1,
    );
    const second = deriveStructuralScaleProposalV1(
      input,
      DEFAULT_STRUCTURAL_SCALE_PROPOSAL_CONFIGURATION_V1,
    );

    expect(first).toEqual(second);
    expect(first).toEqual({
      ok: true,
      value: {
        derivation: STRUCTURAL_SCALE_DERIVATION_V1,
        proposal: "part",
        status: "proposed",
      },
    });
  });

  test("fails closed when measured counts straddle scale thresholds", () => {
    expect(
      deriveStructuralScaleProposalV1(
        { fileCount: 80, reuseBreadth: 1 },
        DEFAULT_STRUCTURAL_SCALE_PROPOSAL_CONFIGURATION_V1,
      ),
    ).toEqual({
      ok: true,
      value: {
        candidates: ["domain", "element"],
        derivation: STRUCTURAL_SCALE_DERIVATION_V1,
        status: "ambiguous",
      },
    });
  });

  test("does not turn unordered boolean markers into a size guess", () => {
    expect(
      deriveStructuralScaleProposalV1(
        { declaredBoundary: true, entryPoint: true },
        DEFAULT_STRUCTURAL_SCALE_PROPOSAL_CONFIGURATION_V1,
      ),
    ).toEqual({
      ok: true,
      value: {
        derivation: STRUCTURAL_SCALE_DERIVATION_V1,
        status: "insufficient",
      },
    });
  });

  test("rejects unordered thresholds instead of guessing", () => {
    const result = deriveStructuralScaleProposalV1(
      { fileCount: 10 },
      {
        derivation: STRUCTURAL_SCALE_DERIVATION_V1,
        thresholds: {
          ...DEFAULT_STRUCTURAL_SCALE_PROPOSAL_CONFIGURATION_V1.thresholds,
          fileCount: { domain: 8, part: 12, system: 16 },
        },
      },
    );

    expect(result).toMatchObject({
      diagnostics: [{ code: "invalid-structural-scale-thresholds" }],
      ok: false,
    });
  });
});
