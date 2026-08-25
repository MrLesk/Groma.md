using Xunit;

namespace Groma.DotNetScanner.Tests;

public sealed class ContractTests
{
    [Fact]
    public void CanonicalJsonDoesNotDependOnDiscoveryOrder()
    {
        ScopeEvidence first = new("a/a.csproj", "A");
        ScopeEvidence second = new("b/b.csproj", "B");
        FileEvidence aFile = new("a/A.cs", [new("global::A", "A", "class")]);
        FileEvidence bFile = new("b/B.cs", [new("global::B", "B", "class")]);

        CompleteScanSnapshot forward = CompleteScanSnapshot.Create(
            Scanner(), Root(), [first, second], [aFile, bFile],
            [new("a/A.cs", first.Id), new("b/B.cs", second.Id)],
            [new(second.Id, first.Id, "project-reference")], []);
        CompleteScanSnapshot reverse = CompleteScanSnapshot.Create(
            Scanner(), Root(), [second, first], [bFile, aFile],
            [new("b/B.cs", second.Id), new("a/A.cs", first.Id)],
            [new(second.Id, first.Id, "project-reference")], []);

        Assert.Equal(forward.ToCanonicalJson(), reverse.ToCanonicalJson());
    }

    [Fact]
    public void DuplicatePrimaryKeysAreRejected()
    {
        ScopeEvidence duplicate = new("a/a.csproj", "A");

        InvalidDataException error = Assert.Throws<InvalidDataException>(() => CompleteScanSnapshot.Create(
            Scanner(), Root(), [duplicate, duplicate], [], [], [], []));

        Assert.Contains("duplicate scope id", error.Message);
    }

    [Fact]
    public void ReferencesToUnknownEvidenceAreRejected()
    {
        InvalidDataException error = Assert.Throws<InvalidDataException>(() => CompleteScanSnapshot.Create(
            Scanner(), Root(), [], [], [new("missing.cs", "missing.csproj")], [], []));

        Assert.Contains("unknown file", error.Message);
    }

    private static ScannerIdentity Scanner() => new("csharp", "roslyn", "test");

    private static ScanRoot Root() => new("solution", "Fixture.sln");
}
