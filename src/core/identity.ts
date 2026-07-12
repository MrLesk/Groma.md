import { failure, type Result, success } from "./result.ts";

declare const entityIdBrand: unique symbol;
declare const relationIdBrand: unique symbol;

export type EntityId = string & { readonly [entityIdBrand]: true };
export type RelationId = string & { readonly [relationIdBrand]: true };

const entityIdPattern = /^ent_[0-9a-f]{32}$/;
const relationIdPattern = /^rel_[0-9a-f]{32}$/;

export interface OpaqueIdSource {
  nextEntityId(): string;
  nextRelationId(): string;
}

export type EntropySource = (byteLength: number) => Uint8Array;

function bytesToHex(bytes: Uint8Array): string {
  if (bytes.length !== 16) {
    throw new RangeError(`Identity entropy must contain 16 bytes; received ${bytes.length}`);
  }

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createOpaqueIdSource(entropy: EntropySource): OpaqueIdSource {
  return {
    nextEntityId: () => `ent_${bytesToHex(entropy(16))}`,
    nextRelationId: () => `rel_${bytesToHex(entropy(16))}`,
  };
}

export function parseEntityId(value: string): Result<EntityId> {
  return entityIdPattern.test(value)
    ? success(value as EntityId)
    : failure({
        code: "invalid-entity-id",
        message: "Entity identity must be an opaque ent_ identifier with 128 lowercase hex bits",
        details: { value },
      });
}

export function parseRelationId(value: string): Result<RelationId> {
  return relationIdPattern.test(value)
    ? success(value as RelationId)
    : failure({
        code: "invalid-relation-id",
        message: "Relation identity must be an opaque rel_ identifier with 128 lowercase hex bits",
        details: { value },
      });
}
