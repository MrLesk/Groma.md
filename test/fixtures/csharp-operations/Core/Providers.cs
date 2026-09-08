namespace Fixture;
public static class Tools
{
    public static int Overload(int value) => value;
    public static string Overload(string value) => value;
    public static T Echo<T>(T value) => value;
}
public static class Extensions
{
    public static int Extend(this int value) => Tools.Overload(value);
}
public interface IRunner { void Run(); }
public class BaseRunner
{
    public virtual void Run() { }
}
public sealed class Runner : BaseRunner, IRunner
{
    public Runner() { }
    public override void Run() { }
    public void CallBase() => base.Run();
}
