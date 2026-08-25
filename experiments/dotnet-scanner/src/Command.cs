namespace Groma.DotNetScanner;

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
            await standardError.WriteLineAsync("Usage: dotnet-scanner <solution.sln|project.csproj>");
            return 2;
        }

        try
        {
            CompleteScanSnapshot snapshot = await new RoslynScanner().ScanAsync(args[0], cancellationToken);
            string json = snapshot.ToCanonicalJson();
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
