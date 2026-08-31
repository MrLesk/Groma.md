using System.Text.Json;

namespace Groma.CSharpScanner;

public sealed record ScannerIdentity(string Language, string Engine, string EngineVersion);
public sealed record ScanRoot(string Kind, string Name, string File);
public sealed record ScanScope(string Id, string Name);
public sealed record ScanSymbol(string Id, string Name, string Kind);
public sealed record ScanFile(string File, IReadOnlyList<ScanSymbol> Symbols);
public sealed record ScanPlacement(string File, string Scope);
public sealed record ScanRelationship(string Source, string Target, string Kind);
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
    IReadOnlyList<ScanDiagnostic> Diagnostics)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
    };

    public static ScanObservation Create(
        ScannerIdentity scanner,
        ScanRoot root,
        IEnumerable<ScanScope> scopes,
        IEnumerable<ScanFile> files,
        IEnumerable<ScanPlacement> placements,
        IEnumerable<ScanRelationship> relationships,
        IEnumerable<ScanDiagnostic> diagnostics)
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

        return new ScanObservation(
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
