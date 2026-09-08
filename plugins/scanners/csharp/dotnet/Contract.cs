using System.Text.Json;
using System.Text.Json.Serialization;

namespace Groma.CSharpScanner;

public sealed record ScannerIdentity(string Language, string Engine, string EngineVersion);
public sealed record ScanRoot(string Kind, string Name, string File);
public sealed record ScanScope(string Id, string Name);
public sealed record ScanSymbol(string Id, string Name, string Kind);
public sealed record ScanFile(string File, IReadOnlyList<ScanSymbol> Symbols);
public sealed record ScanPlacement(string File, string Scope);
public sealed record ScanRelationship(string Source, string Target, string Kind);
public sealed record ScanOperation(string Id, string File, string Name);
public sealed record ScanInvocation(string Source, IReadOnlyList<string> Targets, bool Unresolved, int Line, string? Member = null);
public sealed record ScanDiagnostic(string Severity, string Code, string Message);

public sealed record ScanObservation(
    int SchemaVersion,
    ScannerIdentity Scanner,
    bool Complete,
    ScanRoot Root,
    IReadOnlyList<ScanScope> Scopes,
    IReadOnlyList<ScanFile> Files,
    IReadOnlyList<ScanPlacement> Placements,
    IReadOnlyList<ScanRelationship> Relationships,
    IReadOnlyList<ScanDiagnostic> Diagnostics,
    IReadOnlyList<ScanOperation>? Operations = null,
    IReadOnlyList<ScanInvocation>? Invocations = null)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    public static ScanObservation Create(
        ScannerIdentity scanner,
        ScanRoot root,
        IEnumerable<ScanScope> scopes,
        IEnumerable<ScanFile> files,
        IEnumerable<ScanPlacement> placements,
        IEnumerable<ScanRelationship> relationships,
        IEnumerable<ScanDiagnostic> diagnostics,
        IEnumerable<ScanOperation>? operations = null,
        IEnumerable<ScanInvocation>? invocations = null)
    {
        ScanScope[] orderedScopes = UniqueBy(scopes, scope => scope.Id, "scope id");
        ScanFile[] orderedFiles = UniqueBy(
            files.Select(file => file with
            {
                Symbols = file.Symbols
                    .Distinct()
                    .OrderBy(symbol => symbol.Id, StringComparer.Ordinal)
                    .ThenBy(symbol => symbol.Kind, StringComparer.Ordinal)
                    .ToArray(),
            }),
            file => file.File,
            "file path");
        HashSet<string> scopeIds = orderedScopes.Select(scope => scope.Id).ToHashSet(StringComparer.Ordinal);
        HashSet<string> filePaths = orderedFiles.Select(file => file.File).ToHashSet(StringComparer.Ordinal);
        ScanPlacement[] orderedPlacements = placements
            .Distinct()
            .OrderBy(placement => placement.File, StringComparer.Ordinal)
            .ThenBy(placement => placement.Scope, StringComparer.Ordinal)
            .ToArray();
        ScanRelationship[] orderedRelationships = relationships
            .Distinct()
            .OrderBy(relationship => relationship.Source, StringComparer.Ordinal)
            .ThenBy(relationship => relationship.Target, StringComparer.Ordinal)
            .ThenBy(relationship => relationship.Kind, StringComparer.Ordinal)
            .ToArray();

        HashSet<string> placedFiles = new(StringComparer.Ordinal);
        foreach (ScanPlacement placement in orderedPlacements)
        {
            Require(filePaths.Contains(placement.File), $"Placement references unknown file '{placement.File}'.");
            Require(scopeIds.Contains(placement.Scope), $"Placement references unknown scope '{placement.Scope}'.");
            Require(placedFiles.Add(placement.File), $"File has multiple placements '{placement.File}'.");
        }
        foreach (string file in filePaths)
            Require(placedFiles.Contains(file), $"File has no placement '{file}'.");
        HashSet<string> evidenceIds = [..scopeIds, ..filePaths];
        foreach (ScanRelationship relationship in orderedRelationships)
        {
            Require(evidenceIds.Contains(relationship.Source), $"Relationship references unknown source '{relationship.Source}'.");
            Require(evidenceIds.Contains(relationship.Target), $"Relationship references unknown target '{relationship.Target}'.");
        }

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
            Complete: true,
            Root: root,
            Scopes: orderedScopes,
            Files: orderedFiles,
            Placements: orderedPlacements,
            Relationships: orderedRelationships,
            Operations: orderedOperations,
            Invocations: orderedInvocations,
            Diagnostics: diagnostics
                .Distinct()
                .OrderBy(diagnostic => diagnostic.Severity, StringComparer.Ordinal)
                .ThenBy(diagnostic => diagnostic.Code, StringComparer.Ordinal)
                .ThenBy(diagnostic => diagnostic.Message, StringComparer.Ordinal)
                .ToArray());
    }

    public string ToCanonicalJson() => JsonSerializer.Serialize(this, JsonOptions) + "\n";

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
