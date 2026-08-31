# C#/.NET scanner

The C# scanner uses Roslyn and MSBuild project semantics. `groma scan` discovers a root `.sln` or `.csproj`; scanning C# requires a .NET 10 SDK.

Every project is a scope. Every source file is a separate evidence entry containing the types declared in that file. Partial declarations in different files therefore stay separate. Project membership supplies placement, and project references become source relationships. Generated files under `bin` and `obj` are excluded.

The scanner completes all Roslyn work and validates the observation before writing JSON. A missing project, workspace failure, or invalid input returns an error with no partial standard output. Groma parses that JSON through the same contract used by TypeScript before core sees it.

Enable the scanner from this repository with:

```sh
groma scanner add ./plugins/scanners/csharp
```

The scanner remains a direct local input. It requires a .NET 10 SDK only when
Groma executes a C# scan.

Run the focused C# suite with:

```sh
dotnet test plugins/scanners/csharp/dotnet/test/Groma.CSharpScanner.Tests.csproj
```
