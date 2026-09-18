using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Groma.CSharpScanner;

/// <summary>
/// Requests C# source sends: HttpClient calls, recognized by the receiver's own type, and declarative client
/// interfaces such as Refit, whose attributes state the method and template. Both reach a base address the
/// application configures elsewhere, so their relative paths follow a configured base.
/// </summary>
internal static class HttpRequests
{
    private static readonly Dictionary<string, string> ClientVerbs = new(StringComparer.Ordinal)
    {
        ["GetAsync"] = "GET", ["GetStringAsync"] = "GET", ["GetByteArrayAsync"] = "GET", ["GetStreamAsync"] = "GET",
        ["GetFromJsonAsync"] = "GET", ["GetFromJsonAsAsyncEnumerable"] = "GET",
        ["PostAsync"] = "POST", ["PostAsJsonAsync"] = "POST",
        ["PutAsync"] = "PUT", ["PutAsJsonAsync"] = "PUT",
        ["PatchAsync"] = "PATCH", ["PatchAsJsonAsync"] = "PATCH",
        ["DeleteAsync"] = "DELETE", ["DeleteFromJsonAsync"] = "DELETE",
    };

    /// <summary>Declarative client attributes, whose own name is the request method.</summary>
    private static readonly HashSet<string> DeclarativeVerbs = new(StringComparer.Ordinal)
        { "Get", "Post", "Put", "Delete", "Patch", "Head", "Options" };

    public static (List<ScanHttpRequest> Requests, List<ScanOperation> Declarations) Of(SyntaxNode root, SemanticModel model,
        string file, IReadOnlyDictionary<SyntaxNode, string> callers, CancellationToken cancellationToken)
    {
        List<ScanHttpRequest> requests = [];
        Dictionary<string, ScanOperation> declarations = new(StringComparer.Ordinal);
        foreach (InterfaceDeclarationSyntax client in root.DescendantNodes().OfType<InterfaceDeclarationSyntax>())
        {
            cancellationToken.ThrowIfCancellationRequested();
            Declarative(client, model, file, requests, declarations, cancellationToken);
        }
        foreach (InvocationExpressionSyntax call in root.DescendantNodes().OfType<InvocationExpressionSyntax>())
        {
            cancellationToken.ThrowIfCancellationRequested();
            Client(call, model, callers, requests, cancellationToken);
        }
        return (requests, [.. declarations.Values]);
    }

    private static void Client(InvocationExpressionSyntax call, SemanticModel model,
        IReadOnlyDictionary<SyntaxNode, string> callers, List<ScanHttpRequest> requests, CancellationToken cancellationToken)
    {
        string name = HttpSyntax.CallName(call.Expression);
        bool sends = name == "SendAsync";
        if (!ClientVerbs.TryGetValue(name, out string? method) && !sends) return;
        if (HttpSyntax.Receiver(call) is not ExpressionSyntax receiver || !IsHttpClient(model, receiver, cancellationToken)) return;
        if (call.ArgumentList.Arguments.Count == 0) return;
        ExpressionSyntax url = call.ArgumentList.Arguments[0].Expression;
        if (sends)
        {
            // Only a request message written here states its own method and URL.
            if (url is not ObjectCreationExpressionSyntax { ArgumentList: not null } message
                || HttpSyntax.TypeName(message.Type) != "HttpRequestMessage"
                || message.ArgumentList.Arguments.Count < 2) return;
            method = Method(model, message.ArgumentList.Arguments[0].Expression, cancellationToken);
            url = message.ArgumentList.Arguments[1].Expression;
        }
        if (OperationEvidence.Caller(call, callers) is not string operation) return;
        (bool configured, ScanHttpSegment[] path) = HttpRoutes.Request(HttpSyntax.Url(model, url, cancellationToken));
        requests.Add(new ScanHttpRequest(operation, path, method, configured ? true : null));
    }

    /// <summary>An HttpClient, or a type derived from one. An unresolved receiver is not a recognized client.</summary>
    private static bool IsHttpClient(SemanticModel model, ExpressionSyntax receiver, CancellationToken cancellationToken)
    {
        for (ITypeSymbol? type = model.GetTypeInfo(receiver, cancellationToken).Type; type is not null; type = type.BaseType)
        {
            if (type.Name == "HttpClient" && type.ContainingNamespace?.ToDisplayString() == "System.Net.Http") return true;
        }
        return false;
    }

    /// <summary>The method an HttpRequestMessage states, such as HttpMethod.Post or a literal.</summary>
    private static string? Method(SemanticModel model, ExpressionSyntax expression, CancellationToken cancellationToken)
    {
        if (HttpSyntax.Constant(model, expression, cancellationToken) is string literal) return literal.ToUpperInvariant();
        if (expression is ObjectCreationExpressionSyntax { ArgumentList.Arguments.Count: 1 } created)
            return HttpSyntax.Constant(model, created.ArgumentList.Arguments[0].Expression, cancellationToken)?.ToUpperInvariant();
        return expression is MemberAccessExpressionSyntax access && HttpSyntax.TypeName(access.Expression as TypeSyntax) == "HttpMethod"
            ? access.Name.Identifier.ValueText.ToUpperInvariant() : null;
    }

    private static void Declarative(InterfaceDeclarationSyntax client, SemanticModel model, string file,
        List<ScanHttpRequest> requests, Dictionary<string, ScanOperation> declarations, CancellationToken cancellationToken)
    {
        foreach (MethodDeclarationSyntax declared in client.Members.OfType<MethodDeclarationSyntax>())
        {
            foreach (AttributeSyntax attribute in declared.AttributeLists.SelectMany(list => list.Attributes))
            {
                string verb = HttpSyntax.AttributeName(attribute);
                if (!DeclarativeVerbs.Contains(verb)) continue;
                if (HttpSyntax.Constant(model, HttpSyntax.Template(attribute), cancellationToken) is not string template) continue;
                string operation = OperationId.Of(file, declared);
                // A default implementation is already an operation; only a bodiless declaration needs one here.
                if (declared.Body is null && declared.ExpressionBody is null)
                    declarations.TryAdd(operation, new ScanOperation(operation, file, Name(model, declared, client, cancellationToken)));
                // The client's base address is configured where it is registered, so it precedes every template.
                (_, ScanHttpSegment[] path) = HttpRoutes.Request(HttpRoutes.Template(template));
                requests.Add(new ScanHttpRequest(operation, path, verb.ToUpperInvariant(), Configured: true));
            }
        }
    }

    private static string Name(SemanticModel model, MethodDeclarationSyntax declared, InterfaceDeclarationSyntax client, CancellationToken cancellationToken) =>
        model.GetDeclaredSymbol(declared, cancellationToken)?.ToDisplayString(SymbolDisplayFormat.CSharpErrorMessageFormat)
            ?? $"{client.Identifier.ValueText}.{declared.Identifier.ValueText}()";
}
