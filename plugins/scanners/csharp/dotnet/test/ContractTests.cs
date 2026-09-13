using Xunit;

namespace Groma.CSharpScanner.Tests;

public sealed class ContractTests
{
    [Fact]
    public void InvalidHierarchyAndMembershipAreRejected()
    {
        Assert.Throws<InvalidDataException>(() => ScanObservation.Create(
            Scanner(), [new("a", "project", "A"), new("a", "project", "A")], [], []));
        Assert.Throws<InvalidDataException>(() => ScanObservation.Create(
            Scanner(), [new("a", "project", "A", Parent: "missing")], [], []));
        Assert.Throws<InvalidDataException>(() => ScanObservation.Create(
            Scanner(), [new("a", "project", "A", Parent: "b"), new("b", "project", "B", Parent: "a")], [], []));
        Assert.Throws<InvalidDataException>(() => ScanObservation.Create(
            Scanner(), [new("a", "project", "A")], [new("A.cs", ["missing"], [])], []));
        Assert.Throws<InvalidDataException>(() => ScanObservation.Create(
            Scanner(), [new("a", "project", "A")], [new("A.cs", [], [])], []));
    }

    private static ScannerIdentity Scanner() => new("csharp", "c#/.NET", "roslyn", "test");
}
