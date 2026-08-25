using System.Text.Json;
using System.Text.Json.Serialization;

namespace Groma.DotNetScanner;

public sealed record ScannerIdentity(string Language, string Engine, string EngineVersion);

public sealed record ScanRoot(string Kind, string File);

public sealed record ScopeEvidence(string Id, string Name);

public sealed record SymbolEvidence(string Id, string Name, string Kind);

public sealed record FileEvidence(string File, IReadOnlyList<SymbolEvidence> Symbols);

public sealed record PlacementEvidence(string File, string Scope);

public sealed record RelationshipEvidence(string SourceScope, string TargetScope, string Kind);

public sealed record DiagnosticEvidence(string Severity, string Code, string Message);

public sealed record CompleteScanSnapshot(
    int SchemaVersion,
    ScannerIdentity Scanner,
    bool Complete,
    ScanRoot Root,
    IReadOnlyList<ScopeEvidence> Scopes,
    IReadOnlyList<FileEvidence> Files,
    IReadOnlyList<PlacementEvidence> Placements,
    IReadOnlyList<RelationshipEvidence> Relationships,
    IReadOnlyList<DiagnosticEvidence> Diagnostics)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true,
    };

    public static CompleteScanSnapshot Create(
        ScannerIdentity scanner,
        ScanRoot root,
        IEnumerable<ScopeEvidence> scopes,
        IEnumerable<FileEvidence> files,
        IEnumerable<PlacementEvidence> placements,
        IEnumerable<RelationshipEvidence> relationships,
        IEnumerable<DiagnosticEvidence> diagnostics)
    {
        ScopeEvidence[] orderedScopes = UniqueBy(
            scopes,
            scope => scope.Id,
            "scope id");
        FileEvidence[] orderedFiles = UniqueBy(
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
        PlacementEvidence[] orderedPlacements = placements
            .Distinct()
            .OrderBy(placement => placement.File, StringComparer.Ordinal)
            .ThenBy(placement => placement.Scope, StringComparer.Ordinal)
            .ToArray();
        RelationshipEvidence[] orderedRelationships = relationships
            .Distinct()
            .OrderBy(relationship => relationship.SourceScope, StringComparer.Ordinal)
            .ThenBy(relationship => relationship.TargetScope, StringComparer.Ordinal)
            .ThenBy(relationship => relationship.Kind, StringComparer.Ordinal)
            .ToArray();

        foreach (PlacementEvidence placement in orderedPlacements)
        {
            Require(filePaths.Contains(placement.File), $"Placement references unknown file '{placement.File}'.");
            Require(scopeIds.Contains(placement.Scope), $"Placement references unknown scope '{placement.Scope}'.");
        }

        foreach (RelationshipEvidence relationship in orderedRelationships)
        {
            Require(scopeIds.Contains(relationship.SourceScope), $"Relationship references unknown source scope '{relationship.SourceScope}'.");
            Require(scopeIds.Contains(relationship.TargetScope), $"Relationship references unknown target scope '{relationship.TargetScope}'.");
        }

        return new CompleteScanSnapshot(
            SchemaVersion: 1,
            Scanner: scanner,
            Complete: true,
            Root: root,
            Scopes: orderedScopes,
            Files: orderedFiles,
            Placements: orderedPlacements,
            Relationships: orderedRelationships,
            Diagnostics: diagnostics
                .Distinct()
                .OrderBy(diagnostic => diagnostic.Severity, StringComparer.Ordinal)
                .ThenBy(diagnostic => diagnostic.Code, StringComparer.Ordinal)
                .ThenBy(diagnostic => diagnostic.Message, StringComparer.Ordinal)
                .ToArray());
    }

    public string ToCanonicalJson() => JsonSerializer.Serialize(this, JsonOptions) + "\n";

    private static T[] UniqueBy<T>(
        IEnumerable<T> values,
        Func<T, string> key,
        string keyName)
        where T : notnull
    {
        T[] materialized = values.ToArray();
        string? duplicate = materialized
            .GroupBy(key, StringComparer.Ordinal)
            .FirstOrDefault(group => group.Count() > 1)
            ?.Key;
        Require(duplicate is null, $"Snapshot contains duplicate {keyName} '{duplicate}'.");
        return materialized.OrderBy(key, StringComparer.Ordinal).ToArray();
    }

    private static void Require(bool condition, string message)
    {
        if (!condition)
            throw new InvalidDataException(message);
    }
}
