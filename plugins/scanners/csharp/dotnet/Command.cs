namespace Groma.CSharpScanner;

/// <summary>
/// The worker's two requests, each a JSON document on standard input: a scan observation and the outline of Code files.
/// Requests travel on standard input because repository inventories exceed command-line length limits.
/// </summary>
public static class ScannerCommand
{
    public static async Task<int> RunAsync(
        string[] args,
        TextReader standardInput,
        TextWriter standardOutput,
        TextWriter standardError,
        CancellationToken cancellationToken = default)
    {
        try
        {
            if (args is not (["--scan"] or ["--outline"]))
                throw new ArgumentException("Usage: csharp-scanner --scan|--outline, with its JSON request on standard input.");
            string request = await standardInput.ReadToEndAsync(cancellationToken);
            string output = args[0] == "--outline"
                ? SourceOutline.Run(request, cancellationToken)
                : (await new RoslynScanner().ScanAsync(ScanRequest.Parse(request), cancellationToken)).ToCanonicalJson();
            await standardOutput.WriteAsync(output);
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
