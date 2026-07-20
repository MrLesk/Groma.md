import {
  failure,
  success,
  type ComponentCandidateStructuralSignals,
  type Diagnostic,
  type Result,
} from "../core/index.ts";
import { STANDARD_COMPONENT_SCALES, type StandardComponentScale } from "../standard-model/index.ts";

export const STRUCTURAL_SCALE_DERIVATION_V1 = "groma/structural-scale/v1" as const;

export const STRUCTURAL_SCALE_COUNT_SIGNALS = Object.freeze([
  "fileCount",
  "exportCount",
  "reuseBreadth",
] as const);

export type StructuralScaleCountSignal = (typeof STRUCTURAL_SCALE_COUNT_SIGNALS)[number];

export interface StructuralScaleCutoffs {
  readonly domain: number;
  readonly part: number;
  readonly system: number;
}

export type StructuralScaleThresholdsV1 = Readonly<
  Record<StructuralScaleCountSignal, StructuralScaleCutoffs>
>;

export interface StructuralScaleProposalConfigurationV1 {
  readonly derivation: typeof STRUCTURAL_SCALE_DERIVATION_V1;
  readonly thresholds: StructuralScaleThresholdsV1;
}

export type StructuralScaleAssessmentV1 =
  | {
      readonly derivation: typeof STRUCTURAL_SCALE_DERIVATION_V1;
      readonly status: "insufficient";
    }
  | {
      readonly candidates: readonly StandardComponentScale[];
      readonly derivation: typeof STRUCTURAL_SCALE_DERIVATION_V1;
      readonly status: "ambiguous";
    }
  | {
      readonly derivation: typeof STRUCTURAL_SCALE_DERIVATION_V1;
      readonly proposal: StandardComponentScale;
      readonly status: "proposed";
    };

export const DEFAULT_STRUCTURAL_SCALE_THRESHOLDS_V1: StructuralScaleThresholdsV1 = Object.freeze({
  exportCount: Object.freeze({ domain: 40, part: 8, system: 160 }),
  fileCount: Object.freeze({ domain: 40, part: 8, system: 160 }),
  reuseBreadth: Object.freeze({ domain: 8, part: 2, system: 24 }),
});

export const DEFAULT_STRUCTURAL_SCALE_PROPOSAL_CONFIGURATION_V1: StructuralScaleProposalConfigurationV1 =
  Object.freeze({
    derivation: STRUCTURAL_SCALE_DERIVATION_V1,
    thresholds: DEFAULT_STRUCTURAL_SCALE_THRESHOLDS_V1,
  });

function diagnostic(code: string, message: string): Diagnostic {
  return Object.freeze({ code, message });
}

function validCutoffs(value: StructuralScaleCutoffs): boolean {
  return (
    Number.isSafeInteger(value.part) &&
    Number.isSafeInteger(value.domain) &&
    Number.isSafeInteger(value.system) &&
    value.part >= 0 &&
    value.part < value.domain &&
    value.domain < value.system
  );
}

export function validateStructuralScaleProposalConfigurationV1(
  value: StructuralScaleProposalConfigurationV1,
): Result<StructuralScaleProposalConfigurationV1> {
  if (
    value.derivation !== STRUCTURAL_SCALE_DERIVATION_V1 ||
    STRUCTURAL_SCALE_COUNT_SIGNALS.some((signal) => !validCutoffs(value.thresholds[signal]))
  ) {
    return failure(
      diagnostic(
        "invalid-structural-scale-thresholds",
        "Structural scale thresholds must be ordered non-negative safe integers for every v1 count signal",
      ),
    );
  }
  return success(
    Object.freeze({
      derivation: STRUCTURAL_SCALE_DERIVATION_V1,
      thresholds: Object.freeze({
        exportCount: Object.freeze({ ...value.thresholds.exportCount }),
        fileCount: Object.freeze({ ...value.thresholds.fileCount }),
        reuseBreadth: Object.freeze({ ...value.thresholds.reuseBreadth }),
      }),
    }),
  );
}

function scaleFor(count: number, cutoffs: StructuralScaleCutoffs): StandardComponentScale {
  if (count >= cutoffs.system) return "system";
  if (count >= cutoffs.domain) return "domain";
  if (count >= cutoffs.part) return "part";
  return "element";
}

export function deriveStructuralScaleProposalV1(
  signals: ComponentCandidateStructuralSignals,
  configuration: StructuralScaleProposalConfigurationV1,
): Result<StructuralScaleAssessmentV1> {
  const validated = validateStructuralScaleProposalConfigurationV1(configuration);
  if (!validated.ok) return validated;
  const candidates = new Set<StandardComponentScale>();
  for (const signal of STRUCTURAL_SCALE_COUNT_SIGNALS) {
    const count = signals[signal];
    if (count === undefined) continue;
    if (!Number.isSafeInteger(count) || count < 0) {
      return failure(
        diagnostic(
          "invalid-structural-scale-signals",
          "Structural scale count signals must be non-negative safe integers",
        ),
      );
    }
    candidates.add(scaleFor(count, validated.value.thresholds[signal]));
  }
  if (candidates.size === 0) {
    return success(
      Object.freeze({
        derivation: STRUCTURAL_SCALE_DERIVATION_V1,
        status: "insufficient" as const,
      }),
    );
  }
  if (candidates.size === 1) {
    return success(
      Object.freeze({
        derivation: STRUCTURAL_SCALE_DERIVATION_V1,
        proposal: candidates.values().next().value!,
        status: "proposed" as const,
      }),
    );
  }
  return success(
    Object.freeze({
      candidates: Object.freeze(STANDARD_COMPONENT_SCALES.filter((scale) => candidates.has(scale))),
      derivation: STRUCTURAL_SCALE_DERIVATION_V1,
      status: "ambiguous" as const,
    }),
  );
}
