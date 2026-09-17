using Xunit;

namespace Groma.CSharpScanner.Tests;

public sealed class ComparedOperationTests
{
    [Fact]
    public async Task NamedOperationsCarryTheirBodyWhileLambdasAndTopLevelCodeDoNot()
    {
        using ScannerFixture fixture = new();
        ScanObservation scan = await fixture.ScanAsync(fixture.Solution);
        foreach (string name in new[] { "App.Calls.Nested()", "Fixture.Runner.Runner()", "App.Calls.Value.get", "Local()" })
        {
            ScanOperation operation = Assert.Single(scan.Operations!, operation => operation.Name == name);
            Assert.NotNull(operation.Tokens);
            Assert.InRange(operation.StartLine!.Value, 1, operation.EndLine!.Value);
        }
        ScanOperation[] uncompared = scan.Operations!.Where(operation => operation.Tokens is null).ToArray();
        Assert.Equal(new[] { "<top-level>", "lambda expression" }, uncompared.Select(operation => operation.Name).Order(StringComparer.Ordinal));
        Assert.All(uncompared, operation => Assert.Null(operation.StartLine));
    }

    [Fact]
    public async Task RenamedLocalsNormalize()
    {
        using ScannerFixture fixture = new("csharp-duplicates");
        ScanObservation scan = await fixture.ScanAsync(Path.Combine(fixture.Root, "Scheduling.csproj"));
        IReadOnlyList<string> Tokens(string name) =>
            Assert.Single(scan.Operations!, operation => operation.Name.StartsWith(name + "(", StringComparison.Ordinal)).Tokens!;
        Assert.Equal(Tokens("Scheduling.Readiness.CanStart"), Tokens("Scheduling.Runner.ReadyToRun"));
        // Only the two changed literals differ; the renamed parameters and locals share slots.
        IReadOnlyList<string> total = Tokens("Scheduling.Pricing.Total");
        IReadOnlyList<string> estimate = Tokens("Scheduling.Quote.Estimate");
        Assert.Equal(total.Count, estimate.Count);
        Assert.Equal(2, total.Zip(estimate).Count(pair => pair.First != pair.Second));
    }

    [Fact]
    public async Task ArgumentLabelsAndTheOperationsOwnNameStayText()
    {
        using ScannerFixture fixture = new("csharp-duplicates");
        fixture.Write("Wiring.cs", """
            namespace Scheduling;

            public static class Wiring
            {
                public static int Send(int to, int from) => to - from;
                public static int Forward(int value) => Send(to: value, from: 1);
                public static int Backward(int value) => Send(from: value, to: 1);

                public static int Walk(int depth)
                {
                    int Down(int level) => level > 0 ? Down(level - 1) : 0;
                    int Across(int level) => level > 0 ? Down(level - 1) : 0;
                    return Across(depth);
                }
            }
            """);
        ScanObservation scan = await fixture.ScanAsync(Path.Combine(fixture.Root, "Scheduling.csproj"));
        IReadOnlyList<string> Tokens(string name) =>
            Assert.Single(scan.Operations!, operation => operation.Name.StartsWith(name + "(", StringComparison.Ordinal)).Tokens!;
        Assert.NotEqual(Tokens("Scheduling.Wiring.Forward"), Tokens("Scheduling.Wiring.Backward"));
        // Down calls itself; Across calls another local function.
        Assert.NotEqual(Tokens("Down"), Tokens("Across"));
    }
}
