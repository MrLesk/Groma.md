using Xunit;

namespace Groma.CSharpScanner.Tests;

public sealed class ContractTests
{
    [Fact]
    public void CanonicalJsonDoesNotDependOnDiscoveryOrder()
    {
        ScanScope first = new("scope:a/a.csproj", "A");
        ScanScope second = new("scope:b/b.csproj", "B");
        ScanFile aFile = new("a/A.cs", [new("global::A", "A", "class")]);
        ScanFile bFile = new("b/B.cs", [new("global::B", "B", "class")]);

        ScanObservation forward = ScanObservation.Create(
            Scanner(), Root(), [first, second], [aFile, bFile],
            [new("a/A.cs", first.Id), new("b/B.cs", second.Id)],
            [new(second.Id, first.Id, "project-reference")], []);
        ScanObservation reverse = ScanObservation.Create(
            Scanner(), Root(), [second, first], [bFile, aFile],
            [new("b/B.cs", second.Id), new("a/A.cs", first.Id)],
            [new(second.Id, first.Id, "project-reference")], []);

        Assert.Equal(forward.ToCanonicalJson(), reverse.ToCanonicalJson());
    }

    [Fact]
    public void InvalidEvidenceReferencesAreRejected()
    {
        InvalidDataException duplicate = Assert.Throws<InvalidDataException>(() => ScanObservation.Create(
            Scanner(), Root(), [new("scope:a", "A"), new("scope:a", "A")], [], [], [], []));
        InvalidDataException unknown = Assert.Throws<InvalidDataException>(() => ScanObservation.Create(
            Scanner(), Root(), [], [], [new("missing.cs", "scope:missing")], [], []));
        InvalidDataException unplaced = Assert.Throws<InvalidDataException>(() => ScanObservation.Create(
            Scanner(), Root(), [new("scope:a", "A")], [new("A.cs", [])], [], [], []));

        Assert.Contains("duplicate scope id", duplicate.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("unknown file", unknown.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("no placement", unplaced.Message, StringComparison.OrdinalIgnoreCase);
    }

    private static ScannerIdentity Scanner() => new("csharp", "roslyn", "test");

    private static ScanRoot Root() => new("solution", "Fixture", "Fixture.sln");
}
