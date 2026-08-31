namespace Groma.CSharpScanner;

public static class ScannerCommand
{
    public static async Task<int> RunAsync(
        string[] args,
        TextWriter standardOutput,
        TextWriter standardError,
        CancellationToken cancellationToken = default)
    {
        if (args.Length != 1)
        {
            await standardError.WriteLineAsync("Usage: csharp-scanner <solution.sln|project.csproj>");
            return 2;
        }

        try
        {
            string json = (await new RoslynScanner().ScanAsync(args[0], cancellationToken)).ToCanonicalJson();
            await standardOutput.WriteAsync(json);
            return 0;
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            await standardError.WriteLineAsync(error.Message);
            return 1;
        }
    }
}
