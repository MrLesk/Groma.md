import { describe, expect, test } from "bun:test";

import {
  createYamlConfigurationParser,
  serializeBootstrapConfiguration,
} from "../bootstrap-configuration.ts";

const encoder = new TextEncoder();

describe("workspace structural scale proposal configuration", () => {
  test("pins and round-trips the versioned thresholds deterministically", () => {
    const parser = createYamlConfigurationParser();
    const parsed = parser.parse(
      encoder.encode(`schema: groma/v0.1
scaleProposal:
  derivation: groma/structural-scale/v1
  thresholds:
    exportCount: { part: 4, domain: 20, system: 80 }
    fileCount: { part: 8, domain: 40, system: 160 }
    reuseBreadth: { part: 2, domain: 8, system: 24 }
`),
    );

    expect(parsed).toMatchObject({
      ok: true,
      value: {
        structuralScaleProposal: {
          derivation: "groma/structural-scale/v1",
          thresholds: {
            exportCount: { domain: 20, part: 4, system: 80 },
            fileCount: { domain: 40, part: 8, system: 160 },
            reuseBreadth: { domain: 8, part: 2, system: 24 },
          },
        },
      },
    });
    if (!parsed.ok) return;
    const serialized = serializeBootstrapConfiguration(parsed.value);
    expect(serialized).toContain('derivation: "groma/structural-scale/v1"');
    expect(parser.parse(encoder.encode(serialized))).toEqual(parsed);
  });

  test("uses the versioned defaults for old minimal configuration and rejects unordered cutoffs", () => {
    const parser = createYamlConfigurationParser();
    expect(parser.parse(encoder.encode("schema: groma/v0.1\n"))).toMatchObject({
      ok: true,
      value: {
        structuralScaleProposal: {
          thresholds: { fileCount: { domain: 40, part: 8, system: 160 } },
        },
      },
    });
    expect(
      parser.parse(
        encoder.encode(`schema: groma/v0.1
scaleProposal:
  derivation: groma/structural-scale/v1
  thresholds:
    exportCount: { part: 8, domain: 40, system: 160 }
    fileCount: { part: 50, domain: 40, system: 160 }
    reuseBreadth: { part: 2, domain: 8, system: 24 }
`),
      ),
    ).toMatchObject({
      diagnostics: [{ code: "workspace-configuration-malformed" }],
      ok: false,
    });
  });
});
