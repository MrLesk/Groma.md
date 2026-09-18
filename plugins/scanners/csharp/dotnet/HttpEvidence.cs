using Microsoft.CodeAnalysis;

namespace Groma.CSharpScanner;

/// <summary>
/// The HTTP facts of one scan: the endpoints ASP.NET Core serves and the requests the source sends. A fact survives
/// only when the observation declares its operation, so no fact names an operation core cannot resolve to a file.
/// </summary>
internal sealed class HttpEvidence(string repositoryRoot, bool keepsAsyncSuffix)
{
    private readonly List<ScanHttpEndpoint> endpoints = [];
    private readonly List<ScanHttpRequest> requests = [];
    private readonly Dictionary<string, ScanOperation> declarations = new(StringComparer.Ordinal);

    /// <summary>A declarative client method has no body, so only its request declares it as an operation.</summary>
    public IEnumerable<ScanOperation> Operations => declarations.Values;

    /// <summary>The facts whose operation the observation declares; any other would name an operation core cannot place.</summary>
    public (IEnumerable<ScanHttpEndpoint> Endpoints, IEnumerable<ScanHttpRequest> Requests) Facts(IReadOnlySet<string> operations) => (
        endpoints.Where(endpoint => operations.Contains(endpoint.Operation)),
        requests.Where(request => operations.Contains(request.Operation)));

    public void Extract(SyntaxNode root, SemanticModel model, string file,
        IReadOnlyDictionary<SyntaxNode, string> callers, CancellationToken cancellationToken)
    {
        endpoints.AddRange(HttpEndpoints.Of(root, model, file, repositoryRoot, keepsAsyncSuffix, cancellationToken));
        (List<ScanHttpRequest> sent, List<ScanOperation> declared) = HttpRequests.Of(root, model, file, callers, cancellationToken);
        requests.AddRange(sent);
        foreach (ScanOperation operation in declared) declarations.TryAdd(operation.Id, operation);
    }
}
