using System;
using System.Linq.Expressions;
using Fixture;
using Alias = Fixture.Tools;
namespace App;
public static class Calls
{
    public static void Direct()
    {
        Alias.Overload(1);
        Alias.Overload("one");
        Tools.Echo<string>("one");
        1.Extend();
        Wrapper.Forward();
        _ = new Runner();
        _ = nameof(Tools.Overload);
    }
    public static void Dispatch(IRunner contract, BaseRunner polymorphic, Runner sealedRunner, Action callback, dynamic unknown)
    {
        contract.Run();
        polymorphic.Run();
        sealedRunner.Run();
        callback();
        unknown.Run();
        Console.WriteLine("external");
    }
    public static void Nested()
    {
        int Local() => Tools.Overload(3);
        Func<int> callback = () => Tools.Overload(4);
        Expression<Func<int>> expression = () => Tools.Overload(5);
        _ = Local();
        _ = callback();
        _ = expression;
    }
    public static int Value => Tools.Overload(6);
}
