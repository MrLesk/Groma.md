using Xunit;

namespace Groma.CSharpScanner.Tests;

public sealed class OutlineTests
{
    [Fact]
    public void TopLevelTypesListTheirMethodsUnderTheCSharpVisibilityRules()
    {
        using ScannerFixture fixture = new("csharp-outline");
        CodeFile[] files = SourceOutline.Read(new OutlineRequest(fixture.Root, [
            new SourceReference("Orders/OrderService.cs", ["OrderService", "OrderService.Retry"]),
            new SourceReference("Orders/OrderService.Audit.cs", []),
        ]));
        static string Entry(bool entry) => entry ? " entry" : "";
        static string Summary(CodeType type) => $"{type.Name}:{type.Line} {type.Visibility}{Entry(type.Entry)} ["
            + string.Join(", ", type.Members.Select(member => $"{member.Name}:{member.Line} {member.Visibility}{Entry(member.Entry)}")) + "]";

        // Nested types, fields, events and properties are absent; namespaces are transparent. The type's own name
        // does not mark its constructors as entries; only a Type.Member link marks a member.
        Assert.Equal(new[]
        {
            "OrderPlaced:3 public []",
            "OrderService:5 public entry [OrderService:9 public, OrderService:11 private, ~OrderService:13 private, Place:19 public, "
                + "Place:21 public, Retry:23 protected entry, Reset:25 protected, Audit:27 internal, Trace:29 private, "
                + "operator +:31 public, implicit operator int:33 public]",
            "Money:41 internal [Amount:43 public]",
            "IOrders:46 public [Place:48 public, Hook:50 protected]",
            "Receipt:53 public [Print:55 public]",
            "Status:58 public []",
            "Scratch:60 private [Use:62 public]",
        }, files[0].Declarations.Select(Summary));
        Assert.Equal(new[]
        {
            "OrderService:5 internal [Log:7 private, Export:9 public]",
            "Archive:12 internal [Store:14 public]",
        }, files[1].Declarations.Select(Summary));
    }
}
