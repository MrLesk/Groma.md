const intrinsicPromise = Promise;
const intrinsicPromiseThen = Promise.prototype.then;
const intrinsicSymbolSpecies = Symbol.species;
const intrinsicReflectApply = Reflect.apply;
const intrinsicReflectDeleteProperty = Reflect.deleteProperty;
const intrinsicCreate = Object.create;
const intrinsicDefineProperty = Object.defineProperty;
const intrinsicFreeze = Object.freeze;
const intrinsicGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicPromiseSpeciesDescriptor = (() => {
  const descriptor = intrinsicGetOwnPropertyDescriptor(intrinsicPromise, intrinsicSymbolSpecies);
  return descriptor === undefined ? undefined : intrinsicFreeze(descriptor);
})();
const promiseSpeciesCarrier = (() => {
  const carrier = intrinsicCreate(null) as object;
  intrinsicDefineProperty(carrier, intrinsicSymbolSpecies, {
    configurable: false,
    enumerable: false,
    value: intrinsicPromise,
    writable: false,
  });
  return intrinsicFreeze(carrier);
})();

export type NativePromiseObservation<TResult> =
  | { readonly status: "not-native" | "uncontained" }
  | { readonly promise: Promise<TResult>; readonly status: "observed" };

function descriptorsEqual(
  left: PropertyDescriptor | undefined,
  right: PropertyDescriptor | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  if (left.configurable !== right.configurable || left.enumerable !== right.enumerable) {
    return false;
  }
  const leftIsData = "value" in left;
  if (leftIsData !== "value" in right) return false;
  return leftIsData
    ? left.value === right.value && left.writable === right.writable
    : left.get === right.get && left.set === right.set;
}

function installPromiseObservation<TResult>(
  value: object,
  fulfilled: (value: unknown) => TResult,
  rejected: (reason: unknown) => TResult,
): Promise<TResult> | undefined {
  try {
    return intrinsicReflectApply(intrinsicPromiseThen, value, [
      fulfilled,
      rejected,
    ]) as Promise<TResult>;
  } catch {
    return undefined;
  }
}

/**
 * Observes a native Promise while ignoring own/inherited then methods and safely
 * shadowing constructor/species lookup whenever the descriptor permits it.
 */
export function observeNativePromise<TResult>(
  value: unknown,
  fulfilled: (value: unknown) => TResult,
  rejected: (reason: unknown) => TResult,
): NativePromiseObservation<TResult> {
  if (typeof value !== "object" || value === null) return { status: "not-native" };
  let native = false;
  try {
    native = value instanceof intrinsicPromise;
  } catch {
    return { status: "not-native" };
  }
  if (!native) return { status: "not-native" };

  let constructorDescriptor: PropertyDescriptor | undefined;
  try {
    constructorDescriptor = intrinsicGetOwnPropertyDescriptor(value, "constructor");
  } catch {
    return { status: "uncontained" };
  }

  const configurable = constructorDescriptor?.configurable === true;
  const writableDataProperty =
    constructorDescriptor !== undefined &&
    "value" in constructorDescriptor &&
    constructorDescriptor.writable === true;
  const fixedIntrinsicPromiseConstructor =
    constructorDescriptor !== undefined &&
    "value" in constructorDescriptor &&
    constructorDescriptor.value === intrinsicPromise &&
    constructorDescriptor.configurable === false &&
    constructorDescriptor.writable === false;
  if (fixedIntrinsicPromiseConstructor) {
    let currentSpeciesDescriptor: PropertyDescriptor | undefined;
    try {
      currentSpeciesDescriptor = intrinsicGetOwnPropertyDescriptor(
        intrinsicPromise,
        intrinsicSymbolSpecies,
      );
    } catch {
      return { status: "uncontained" };
    }
    if (!descriptorsEqual(currentSpeciesDescriptor, intrinsicPromiseSpeciesDescriptor)) {
      return { status: "uncontained" };
    }
    const promise = installPromiseObservation(value, fulfilled, rejected);
    return promise === undefined ? { status: "uncontained" } : { promise, status: "observed" };
  }
  if (constructorDescriptor !== undefined && !configurable && !writableDataProperty) {
    return { status: "uncontained" };
  }

  let shadowed = false;
  let promise: Promise<TResult> | undefined;
  try {
    intrinsicDefineProperty(
      value,
      "constructor",
      constructorDescriptor === undefined || configurable
        ? {
            configurable: true,
            enumerable: constructorDescriptor?.enumerable ?? false,
            value: promiseSpeciesCarrier,
            writable: true,
          }
        : { value: promiseSpeciesCarrier },
    );
    shadowed = true;
    promise = installPromiseObservation(value, fulfilled, rejected);
  } catch {
    // Fail closed when safe Promise observation is unavailable.
  } finally {
    if (shadowed) {
      try {
        if (constructorDescriptor === undefined) {
          intrinsicReflectDeleteProperty(value, "constructor");
        } else {
          intrinsicDefineProperty(value, "constructor", constructorDescriptor);
        }
      } catch {
        // Restoration cannot safely consult provider-controlled behavior.
      }
    }
  }
  return promise === undefined ? { status: "uncontained" } : { promise, status: "observed" };
}

export function containNativePromise(value: object): "contained" | "not-native" | "uncontained" {
  const observation = observeNativePromise(
    value,
    () => undefined,
    () => undefined,
  );
  return observation.status === "observed" ? "contained" : observation.status;
}
