namespace Groma.CSharpScanner;

public static class ScannerCommand
{
    public static async Task<int> RunAsync(
        string[] args,
        TextWriter standardOutput,
        TextWriter standardError,
        CancellationToken cancellationToken = default)
    {
        try
        {
            ScanRequest request = ScanRequest.Parse(args);
            string json = (await new RoslynScanner().ScanAsync(request, cancellationToken)).ToCanonicalJson();
            await standardOutput.WriteAsync(json);
            return 0;
        }
        catch (OperationCanceledException)
        {
            await standardError.WriteLineAsync("C# scan cancelled; no observation was published.");
            return 1;
        }
        catch (Exception error)
        {
            await standardError.WriteLineAsync(error.Message);
            return error is ArgumentException ? 2 : 1;
        }
    }
}
