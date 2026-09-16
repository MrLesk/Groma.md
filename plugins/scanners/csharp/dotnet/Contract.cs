using System.Text.Json;
using System.Text.Json.Serialization;

namespace Groma.CSharpScanner;

public sealed record ScannerIdentity(string Id, string Technology, string Engine, string EngineVersion);
public sealed record ScanRoot(string Id, string Kind, string Name, string? File = null, string? Parent = null);
public sealed record ScanSymbol(string Id, string Name, string Kind);
public sealed record ScanFile(string File, IReadOnlyList<string> Roots, IReadOnlyList<ScanSymbol> Symbols);
public sealed record ScanSourceUnit(string Primary, IReadOnlyList<string> Files);
public sealed record ScanOperation(string Id, string File, string Name);
public sealed record ScanInvocation(string Source, IReadOnlyList<string> Targets, bool Unresolved, int Line, string? Member = null);
public sealed record ScanDiagnostic(string Severity, string Code, string Message, string? File = null, int? Line = null);

public sealed record ScanObservation(
    int SchemaVersion,
    ScannerIdentity Scanner,
    IReadOnlyList<ScanRoot> Roots,
    IReadOnlyList<ScanFile> Files,
    IReadOnlyList<ScanDiagnostic> Diagnostics,
    IReadOnlyList<ScanOperation>? Operations = null,
    IReadOnlyList<ScanInvocation>? Invocations = null,
    IReadOnlyList<ScanSourceUnit>? SourceUnits = null)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static ScanObservation Create(
        ScannerIdentity scanner,
        IEnumerable<ScanRoot> roots,
        IEnumerable<ScanFile> files,
        IEnumerable<ScanDiagnostic> diagnostics,
        IEnumerable<ScanOperation>? operations = null,
        IEnumerable<ScanInvocation>? invocations = null,
        IEnumerable<ScanSourceUnit>? sourceUnits = null)
    {
        ScanRoot[] orderedRoots = ValidateRoots(roots);
        ScanFile[] orderedFiles = UniqueBy(
            files.Select(file => file with
            {
                Roots = file.Roots.Distinct().Order(StringComparer.Ordinal).ToArray(),
                Symbols = file.Symbols
                    .Distinct()
                    .OrderBy(symbol => symbol.Id, StringComparer.Ordinal)
                    .ThenBy(symbol => symbol.Kind, StringComparer.Ordinal)
                    .ToArray(),
            }),
            file => file.File,
            "file path");
        HashSet<string> rootIds = orderedRoots.Select(root => root.Id).ToHashSet(StringComparer.Ordinal);
        HashSet<string> filePaths = orderedFiles.Select(file => file.File).ToHashSet(StringComparer.Ordinal);
        foreach (ScanFile file in orderedFiles)
        {
            Require(file.Roots.Count > 0, $"File has no root '{file.File}'.");
            Require(file.Roots.All(rootIds.Contains), $"File references unknown root '{file.File}'.");
        }
        ScanDiagnostic[] messages = diagnostics.ToArray();
        foreach (ScanDiagnostic diagnostic in messages)
            Require(diagnostic.Line is null or > 0, "Diagnostic line must be positive.");

        ScanOperation[]? orderedOperations = operations is null ? null : UniqueBy(operations, operation => operation.Id, "operation id");
        ScanInvocation[]? orderedInvocations = orderedOperations is null ? null : (invocations ?? [])
            .OrderBy(invocation => invocation.Source, StringComparer.Ordinal)
            .ThenBy(invocation => invocation.Line)
            .ThenBy(invocation => invocation.Member, StringComparer.Ordinal)
            .ThenBy(invocation => string.Join(";", invocation.Targets), StringComparer.Ordinal)
            .ToArray();
        Require(operations is not null || invocations is null, "Invocations require operation declarations.");
        if (orderedOperations is not null)
        {
            HashSet<string> operationIds = orderedOperations.Select(operation => operation.Id).ToHashSet(StringComparer.Ordinal);
            foreach (ScanOperation operation in orderedOperations)
                Require(filePaths.Contains(operation.File), $"Operation references unknown file '{operation.File}'.");
            foreach (ScanInvocation invocation in orderedInvocations!)
            {
                Require(operationIds.Contains(invocation.Source) && invocation.Targets.All(operationIds.Contains), "Invocation references an unknown operation.");
                Require(invocation.Targets.Count > 0 || invocation.Unresolved, "An empty target set must remain unresolved.");
                Require(invocation.Line > 0, "Invocation line must be positive.");
            }
        }

        return new ScanObservation(
            SchemaVersion: 1,
            Scanner: scanner,
            Roots: orderedRoots,
            Files: orderedFiles,
            Operations: orderedOperations,
            Invocations: orderedInvocations,
            SourceUnits: ValidateUnits(sourceUnits, filePaths),
            Diagnostics: messages
                .Distinct()
                .OrderBy(diagnostic => diagnostic.Severity, StringComparer.Ordinal)
                .ThenBy(diagnostic => diagnostic.Code, StringComparer.Ordinal)
                .ThenBy(diagnostic => diagnostic.Message, StringComparer.Ordinal)
                .ThenBy(diagnostic => diagnostic.File, StringComparer.Ordinal)
                .ThenBy(diagnostic => diagnostic.Line)
                .ToArray());
    }

    public string ToCanonicalJson() => JsonSerializer.Serialize(this, JsonOptions) + "\n";

    private static ScanSourceUnit[]? ValidateUnits(IEnumerable<ScanSourceUnit>? input, HashSet<string> paths)
    {
        if (input is null) return null;
        ScanSourceUnit[] units = input.Select(unit => unit with
        {
            Files = unit.Files.Distinct().Order(StringComparer.Ordinal).ToArray(),
        }).OrderBy(unit => unit.Primary, StringComparer.Ordinal).ToArray();
        foreach (ScanSourceUnit unit in units)
        {
            Require(unit.Files.Contains(unit.Primary), "Source unit omits its primary file.");
            Require(unit.Files.All(paths.Contains), "Source unit references an unknown file.");
        }
        return units;
    }

    private static ScanRoot[] ValidateRoots(IEnumerable<ScanRoot> input)
    {
        ScanRoot[] roots = UniqueBy(input, root => root.Id, "root id");
        var byId = roots.ToDictionary(root => root.Id, StringComparer.Ordinal);
        foreach (ScanRoot root in roots)
        {
            HashSet<string> visited = [root.Id];
            string? parent = root.Parent;
            while (parent is not null)
            {
                Require(visited.Add(parent), $"Root hierarchy contains a cycle '{parent}'.");
                Require(byId.ContainsKey(parent), $"Root references unknown parent '{parent}'.");
                parent = byId[parent].Parent;
            }
        }
        return roots;
    }

    private static T[] UniqueBy<T>(IEnumerable<T> values, Func<T, string> key, string label)
        where T : notnull
    {
        T[] materialized = values.ToArray();
        string? duplicate = materialized
            .GroupBy(key, StringComparer.Ordinal)
            .FirstOrDefault(group => group.Count() > 1)
            ?.Key;
        Require(duplicate is null, $"Snapshot contains duplicate {label} '{duplicate}'.");
        return materialized.OrderBy(key, StringComparer.Ordinal).ToArray();
    }

    private static void Require(bool condition, string message)
    {
        if (!condition)
            throw new InvalidDataException(message);
    }
}
