using Xunit;

namespace Groma.CSharpScanner.Tests;

public sealed class OperationTests
{
    [Fact]
    public async Task NestedProjectPreservesCanonicalCallsWithoutClaimingRuntimeDispatch()
    {
        using ScannerFixture fixture = new();
        await fixture.RestoreAsync();
        ScanObservation scan = await fixture.ScanAsync();
        Assert.Equal("App/App.csproj", scan.Root.File);
        Assert.Contains(scan.Files, file => file.File == "Core/Providers.cs");
        Assert.Equal(2, scan.Scopes.Count);
        Dictionary<string, ScanOperation> operations = scan.Operations!.ToDictionary(operation => operation.Id);
        ScanInvocation[] Direct(string member) => scan.Invocations!
            .Where(call => operations[call.Source].Name == "App.Calls.Direct()" && call.Member == member).ToArray();
        string[] names = Direct("Overload").SelectMany(call => call.Targets).Select(id => operations[id].Name).Order().ToArray();
        Assert.Equal(new[] { "Fixture.Tools.Overload(int)", "Fixture.Tools.Overload(string)" }, names);
        Assert.All(Direct("Overload"), call => Assert.False(call.Unresolved));
        Assert.Equal("Fixture.Tools.Echo<T>(T)", operations[Assert.Single(Assert.Single(Direct("Echo")).Targets)].Name);
        Assert.Equal("Fixture.Extensions.Extend(int)", operations[Assert.Single(Assert.Single(Direct("Extend")).Targets)].Name);
        Assert.Equal("App/Wrapper.cs", operations[Assert.Single(Assert.Single(Direct("Forward")).Targets)].File);
        Assert.DoesNotContain(scan.Invocations!, call => call.Member == "nameof");

        ScanInvocation partial = Assert.Single(scan.Invocations!, call => call.Member == "Step");
        Assert.False(partial.Unresolved);
        Assert.Equal("Core/Partial.Implementation.cs", operations[Assert.Single(partial.Targets)].File);
        Assert.DoesNotContain(scan.Operations!, operation => operation.File == "Core/Partial.Declaration.cs" && operation.Name.EndsWith("Step()", StringComparison.Ordinal));

        ScanInvocation[] dispatch = scan.Invocations!.Where(call => operations[call.Source].Name.StartsWith("App.Calls.Dispatch(", StringComparison.Ordinal)).OrderBy(call => call.Line).ToArray();
        Assert.Equal(6, dispatch.Length);
        Assert.True(dispatch[0].Unresolved); Assert.Empty(dispatch[0].Targets); // interface
        Assert.True(dispatch[1].Unresolved); Assert.Single(dispatch[1].Targets); // virtual declaration is only a candidate
        Assert.False(dispatch[2].Unresolved); Assert.Single(dispatch[2].Targets); // sealed receiver
        Assert.All(dispatch.Skip(3), call => { Assert.True(call.Unresolved); Assert.Empty(call.Targets); });
        ScanInvocation baseCall = Assert.Single(scan.Invocations!, call => operations[call.Source].Name == "Fixture.Runner.CallBase()");
        Assert.False(baseCall.Unresolved);
        Assert.Equal("Fixture.BaseRunner.Run()", operations[Assert.Single(baseCall.Targets)].Name);

        ScanOperation topLevel = Assert.Single(scan.Operations!, operation => operation.Name == "<top-level>");
        ScanInvocation boot = Assert.Single(scan.Invocations!, call => call.Source == topLevel.Id);
        Assert.False(boot.Unresolved);
        Assert.NotEqual(topLevel.Id, Assert.Single(boot.Targets));
        Assert.Contains(scan.Operations!, operation => operation.Name == "App.Calls.Value.get");
        Assert.All(scan.Invocations!.Where(call => call.Targets.Count == 0), call => Assert.True(call.Unresolved));
    }

    [Fact]
    public async Task LambdaAndLocalBodiesKeepTheirOwnCallerAndExpressionTreesAreNotCalls()
    {
        using ScannerFixture fixture = new();
        await fixture.RestoreAsync();
        ScanObservation scan = await fixture.ScanAsync();
        Dictionary<string, ScanOperation> operations = scan.Operations!.ToDictionary(operation => operation.Id);
        ScanInvocation[] nested = scan.Invocations!.Where(call => operations[call.Source].Name == "App.Calls.Nested()").ToArray();
        Assert.Equal(2, nested.Length); // local invocation and unknown delegate invocation, not their bodies
        Assert.Contains(nested, call => !call.Unresolved && call.Member == "Local");
        Assert.Contains(nested, call => call.Unresolved && call.Targets.Count == 0);
        int expressionLine = File.ReadAllLines(Path.Combine(fixture.Root, "App/Calls.cs")).Select((line, index) => (line, index))
            .Single(item => item.line.Contains("Expression<Func<int>> expression", StringComparison.Ordinal)).index + 1;
        Assert.DoesNotContain(scan.Invocations!, call => operations[call.Source].File == "App/Calls.cs" && call.Line == expressionLine);
    }

    [Fact]
    public async Task SolutionAndProjectEvidenceAreDeterministicAndUseTheSamePhysicalFileScope()
    {
        using ScannerFixture fixture = new();
        await fixture.RestoreAsync();
        ScanObservation first = await fixture.ScanAsync(fixture.Solution);
        ScanObservation second = await fixture.ScanAsync(fixture.Solution);
        Assert.Equal(first.ToCanonicalJson(), second.ToCanonicalJson());
        Assert.DoesNotContain(first.Files, file => file.File.Contains("/obj/", StringComparison.Ordinal) || file.File.Contains("/bin/", StringComparison.Ordinal));
    }
}
