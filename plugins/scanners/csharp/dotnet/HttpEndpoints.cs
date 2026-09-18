using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Groma.CSharpScanner;

/// <summary>
/// Endpoints ASP.NET Core serves: attribute-routed controller actions and minimal API route builders, including
/// route groups. A route that is not literal, or a builder that is not proven to be the application or a group,
/// reports nothing rather than a guessed path.
/// </summary>
internal static class HttpEndpoints
{
    private static readonly Dictionary<string, string> ActionVerbs = new(StringComparer.Ordinal)
    {
        ["HttpGet"] = "GET", ["HttpPost"] = "POST", ["HttpPut"] = "PUT", ["HttpDelete"] = "DELETE",
        ["HttpPatch"] = "PATCH", ["HttpHead"] = "HEAD", ["HttpOptions"] = "OPTIONS", ["Route"] = "*",
    };

    private static readonly Dictionary<string, string> MapVerbs = new(StringComparer.Ordinal)
    {
        ["MapGet"] = "GET", ["MapPost"] = "POST", ["MapPut"] = "PUT", ["MapDelete"] = "DELETE", ["MapPatch"] = "PATCH",
    };

    public static List<ScanHttpEndpoint> Of(SyntaxNode root, SemanticModel model, string file, string repositoryRoot, CancellationToken cancellationToken)
    {
        List<ScanHttpEndpoint> endpoints = [];
        foreach (TypeDeclarationSyntax type in root.DescendantNodes().OfType<TypeDeclarationSyntax>())
        {
            cancellationToken.ThrowIfCancellationRequested();
            // A declarative client shares these attributes but sends requests, so only classes serve.
            if (type is not InterfaceDeclarationSyntax) Controller(type, model, file, endpoints, cancellationToken);
        }
        foreach (InvocationExpressionSyntax call in root.DescendantNodes().OfType<InvocationExpressionSyntax>())
        {
            cancellationToken.ThrowIfCancellationRequested();
            Mapped(call, model, file, repositoryRoot, endpoints, cancellationToken);
        }
        return endpoints;
    }

    private static void Controller(TypeDeclarationSyntax type, SemanticModel model, string file,
        List<ScanHttpEndpoint> endpoints, CancellationToken cancellationToken)
    {
        // An abstract controller serves nothing of its own.
        if (type.Modifiers.Any(SyntaxKind.AbstractKeyword)) return;
        List<string>? prefixes = Templates(type.AttributeLists, model, cancellationToken);
        if (prefixes is null) return;
        // MVC inherits a class [Route], and a base this file does not declare may carry one.
        if (prefixes.Count == 0 && !InheritsOnlyControllerBase(type)) return;
        foreach (MethodDeclarationSyntax action in type.Members.OfType<MethodDeclarationSyntax>())
        {
            if (action.Body is null && action.ExpressionBody is null) continue;
            (List<string> methods, List<string> templates) = Routes(action, model, cancellationToken);
            if (methods.Count == 0) continue;
            string operation = OperationId.Of(file, action);
            foreach (string prefix in prefixes.Count == 0 ? [""] : prefixes)
            {
                foreach (string template in templates.Count == 0 ? [""] : templates)
                {
                    // Without a class prefix, an action needs its own template to be routable.
                    if (prefix.Length == 0 && template.Length == 0) continue;
                    string? path = Tokens(HttpRoutes.Join(prefix, template), type, action);
                    if (path is null || HttpRoutes.Endpoint(path) is not ScanHttpSegment[] segments) continue;
                    foreach (string method in methods) endpoints.Add(new ScanHttpEndpoint(operation, method, segments));
                }
            }
        }
    }

    /// <summary>Only the framework base types are known to carry no route prefix of their own.</summary>
    private static bool InheritsOnlyControllerBase(TypeDeclarationSyntax type) => type.BaseList is null
        || type.BaseList.Types.All(inherited => HttpSyntax.TypeName(inherited.Type) is "ControllerBase" or "Controller");

    /// <summary>Class-level route prefixes, or null when one is computed and hides every action's path.</summary>
    private static List<string>? Templates(SyntaxList<AttributeListSyntax> lists, SemanticModel model, CancellationToken cancellationToken)
    {
        List<string> templates = [];
        foreach (AttributeSyntax attribute in lists.SelectMany(list => list.Attributes))
        {
            if (HttpSyntax.AttributeName(attribute) != "Route") continue;
            if (HttpSyntax.Constant(model, HttpSyntax.Template(attribute), cancellationToken) is not string text) return null;
            templates.Add(text);
        }
        return templates;
    }

    /// <summary>
    /// The methods an action allows and the templates it declares. A verb attribute without a template only
    /// constrains methods, so the union of the action's methods applies to every template it declares. An action
    /// with a computed template reports nothing.
    /// </summary>
    private static (List<string> Methods, List<string> Templates) Routes(MethodDeclarationSyntax action,
        SemanticModel model, CancellationToken cancellationToken)
    {
        List<string> methods = [];
        List<string> templates = [];
        bool routed = false;
        foreach (AttributeSyntax attribute in action.AttributeLists.SelectMany(list => list.Attributes))
        {
            if (!ActionVerbs.TryGetValue(HttpSyntax.AttributeName(attribute), out string? method)) continue;
            routed = true;
            if (method != "*" && !methods.Contains(method)) methods.Add(method);
            ExpressionSyntax? template = HttpSyntax.Template(attribute);
            if (template is null) continue;
            if (HttpSyntax.Constant(model, template, cancellationToken) is not string text) return ([], []);
            templates.Add(text);
        }
        if (!routed) return ([], []);
        return (methods.Count == 0 ? ["*"] : methods, templates);
    }

    /// <summary>Replaces the route tokens ASP.NET Core fills in; any other token leaves the path unknown.</summary>
    private static string? Tokens(string path, TypeDeclarationSyntax type, MethodDeclarationSyntax action)
    {
        string name = type.Identifier.ValueText;
        if (name.EndsWith("Controller", StringComparison.Ordinal)) name = name[..^"Controller".Length];
        path = path.Replace("[controller]", name, StringComparison.OrdinalIgnoreCase);
        path = path.Replace("[action]", action.Identifier.ValueText, StringComparison.OrdinalIgnoreCase);
        return path.Contains('[') || path.Contains(']') ? null : path;
    }

    private static void Mapped(InvocationExpressionSyntax call, SemanticModel model, string file, string repositoryRoot,
        List<ScanHttpEndpoint> endpoints, CancellationToken cancellationToken)
    {
        string name = HttpSyntax.CallName(call.Expression);
        bool listed = name == "MapMethods";
        if (!MapVerbs.TryGetValue(name, out string? verb) && !listed) return;
        SeparatedSyntaxList<ArgumentSyntax> arguments = call.ArgumentList.Arguments;
        if (arguments.Count < (listed ? 3 : 2)) return;
        if (HttpSyntax.Constant(model, arguments[0].Expression, cancellationToken) is not string pattern) return;
        if (Prefix(HttpSyntax.Receiver(call), model, 0, cancellationToken) is not string prefix) return;
        string? operation = Handler(arguments[listed ? 2 : 1].Expression, model, file, repositoryRoot, cancellationToken);
        if (operation is null || HttpRoutes.Endpoint(HttpRoutes.Under(prefix, pattern)) is not ScanHttpSegment[] segments) return;
        foreach (string method in listed ? Methods(model, arguments[1].Expression, cancellationToken) : [verb!])
            endpoints.Add(new ScanHttpEndpoint(operation, method, segments));
    }

    /// <summary>The operation that answers: the handler lambda, or the method a method group names.</summary>
    private static string? Handler(ExpressionSyntax handler, SemanticModel model, string file, string repositoryRoot, CancellationToken cancellationToken)
    {
        if (handler is AnonymousFunctionExpressionSyntax) return OperationId.Of(file, handler);
        SymbolInfo info = model.GetSymbolInfo(handler, cancellationToken);
        // An unresolved delegate type leaves the named method as the only candidate.
        IMethodSymbol? method = info.Symbol as IMethodSymbol
            ?? (info.CandidateSymbols.Length == 1 ? info.CandidateSymbols[0] as IMethodSymbol : null);
        return OperationId.OfMethod(repositoryRoot, method);
    }

    /// <summary>The literal methods of MapMethods, or none when any is computed.</summary>
    private static List<string> Methods(SemanticModel model, ExpressionSyntax expression, CancellationToken cancellationToken)
    {
        IEnumerable<ExpressionSyntax> elements = expression switch
        {
            ImplicitArrayCreationExpressionSyntax array => array.Initializer.Expressions,
            ArrayCreationExpressionSyntax array => array.Initializer?.Expressions ?? [],
            CollectionExpressionSyntax collection => collection.Elements.OfType<ExpressionElementSyntax>().Select(element => element.Expression),
            _ => [],
        };
        List<string> methods = [];
        foreach (ExpressionSyntax element in elements)
        {
            if (HttpSyntax.Constant(model, element, cancellationToken) is not string method) return [];
            methods.Add(method.ToUpperInvariant());
        }
        return methods;
    }

    /// <summary>
    /// The route prefix a builder expression carries: empty for the application itself, a group's literal prefixes,
    /// or null when the builder cannot be traced, such as a group passed in as a parameter.
    /// </summary>
    private static string? Prefix(ExpressionSyntax? builder, SemanticModel model, int depth, CancellationToken cancellationToken)
    {
        if (builder is null || depth > 8) return null;
        if (builder is InvocationExpressionSyntax call)
        {
            string name = HttpSyntax.CallName(call.Expression);
            // Building the application starts at its root; other fluent calls keep the same builder.
            if (name == "Build") return "";
            if (name != "MapGroup") return Prefix(HttpSyntax.Receiver(call), model, depth + 1, cancellationToken);
            string? parent = Prefix(HttpSyntax.Receiver(call), model, depth + 1, cancellationToken);
            string? pattern = call.ArgumentList.Arguments.Count == 0 ? null
                : HttpSyntax.Constant(model, call.ArgumentList.Arguments[0].Expression, cancellationToken);
            return parent is null || pattern is null ? null : HttpRoutes.Under(parent, pattern);
        }
        if (builder is MemberAccessExpressionSyntax access) return Prefix(access.Name, model, depth + 1, cancellationToken);
        if (builder is not SimpleNameSyntax) return null;
        ISymbol? symbol = model.GetSymbolInfo(builder, cancellationToken).Symbol;
        if (symbol is null || Reassigned(symbol, builder, model, cancellationToken)) return null;
        // A name assigned once in this file carries its value; otherwise only a WebApplication is a known root.
        if (HttpSyntax.Initializer(symbol) is ExpressionSyntax assigned)
        {
            return assigned.SyntaxTree == model.SyntaxTree ? Prefix(assigned, model, depth + 1, cancellationToken) : null;
        }
        return HttpSyntax.DeclaredTypeName(symbol) == "WebApplication" ? "" : null;
    }

    /// <summary>A builder assigned again, or passed by reference, no longer carries one known prefix.</summary>
    private static bool Reassigned(ISymbol symbol, SyntaxNode node, SemanticModel model, CancellationToken cancellationToken)
    {
        foreach (SyntaxNode candidate in node.SyntaxTree.GetRoot(cancellationToken).DescendantNodes())
        {
            ExpressionSyntax? written = candidate switch
            {
                AssignmentExpressionSyntax assignment => assignment.Left,
                ArgumentSyntax argument when !argument.RefKindKeyword.IsKind(SyntaxKind.None) => argument.Expression,
                _ => null,
            };
            if (written is null) continue;
            if (SymbolEqualityComparer.Default.Equals(model.GetSymbolInfo(written, cancellationToken).Symbol, symbol)) return true;
        }
        return false;
    }
}
