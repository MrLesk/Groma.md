export type NativePromiseObservation<TResult> =
  | { readonly status: "not-native" | "uncontained" }
  | { readonly promise: Promise<TResult>; readonly status: "observed" };

export function observeNativePromise<TResult>(
  value: unknown,
  fulfilled: (value: unknown) => TResult,
  rejected: (reason: unknown) => TResult,
): NativePromiseObservation<TResult> {
  if (!(value instanceof Promise)) return { status: "not-native" };
  return { promise: value.then(fulfilled, rejected), status: "observed" };
}

export function containNativePromise(value: object): "contained" | "not-native" | "uncontained" {
  return value instanceof Promise ? "contained" : "not-native";
}
