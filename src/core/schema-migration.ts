import type { Result } from "./result.ts";

export const canonicalSchemaMigrationApiVersion = "groma.schema-migration/v1" as const;
export const canonicalSchemaMigratorCapabilityId = "groma.schema-migrators/v1" as const;

export interface CanonicalSchemaDefinition {
  readonly schema: string;
  readonly version: number;
}

export interface CanonicalSchemaMigrationInput {
  readonly bytes: Uint8Array;
  readonly locator: string;
  readonly schema: string;
  readonly version: number;
}

export interface CanonicalSchemaMigrationOutput {
  readonly bytes: Uint8Array;
}

export interface CanonicalSchemaMigrator {
  readonly fromSchema: string;
  readonly fromVersion: number;
  readonly id: string;
  migrate(
    input: CanonicalSchemaMigrationInput,
  ): Promise<Result<CanonicalSchemaMigrationOutput>> | Result<CanonicalSchemaMigrationOutput>;
  readonly toSchema: string;
  readonly toVersion: number;
}

/**
 * One runtime capability value contributed through `groma.schema-migrators/v1`.
 * The Host treats declarations as inert until an explicit migration operation runs.
 */
export interface CanonicalSchemaMigrationContribution {
  readonly apiVersion: typeof canonicalSchemaMigrationApiVersion;
  readonly id: string;
  readonly migrators: readonly CanonicalSchemaMigrator[];
  readonly schemas: readonly CanonicalSchemaDefinition[];
}
