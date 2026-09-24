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
        ["HttpPatch"] = "PATCH", ["HttpHead"] = "HEAD", ["HttpOptions"] = "OPTIONS",
    };

    private static readonly Dictionary<string, string> MapVerbs = new(StringComparer.Ordinal)
    {
        ["MapGet"] = "GET", ["MapPost"] = "POST", ["MapPut"] = "PUT", ["MapDelete"] = "DELETE", ["MapPatch"] = "PATCH",
    };

    /// <summary>
    /// Settings anywhere in the scanned source that change what [controller] and [action] stand for: assigning
    /// SuppressAsyncSuffixInActionNames anything but true keeps Async in action names, and a
    /// RouteTokenTransformerConvention rewrites every token value.
    /// </summary>
    internal sealed record TokenConventions(bool KeepsAsyncSuffix, bool TransformsTokens);

    public static async Task<TokenConventions> Conventions(IEnumerable<Document> documents, CancellationToken cancellationToken)
    {
        bool keepsAsyncSuffix = false;
        bool transformsTokens = false;
        foreach (Document document in documents)
        {
            if (await document.GetSyntaxRootAsync(cancellationToken) is not SyntaxNode root) continue;
            keepsAsyncSuffix |= root.DescendantNodes().OfType<AssignmentExpressionSyntax>().Any(assignment =>
                HttpSyntax.CallName(assignment.Left) == "SuppressAsyncSuffixInActionNames" && !assignment.Right.IsKind(SyntaxKind.TrueLiteralExpression));
            transformsTokens |= root.DescendantNodes().OfType<SimpleNameSyntax>()
                .Any(name => name.Identifier.ValueText == "RouteTokenTransformerConvention");
        }
        return new TokenConventions(keepsAsyncSuffix, transformsTokens);
    }

    public static List<ScanHttpEndpoint> Of(SyntaxNode root, SemanticModel model, string file, string repositoryRoot,
        TokenConventions conventions, CancellationToken cancellationToken)
    {
        List<ScanHttpEndpoint> endpoints = [];
        foreach (TypeDeclarationSyntax type in root.DescendantNodes().OfType<TypeDeclarationSyntax>())
        {
            cancellationToken.ThrowIfCancellationRequested();
            // A declarative client shares these attributes but sends requests, so only classes serve.
            if (type is not InterfaceDeclarationSyntax) Controller(type, model, file, conventions, endpoints, cancellationToken);
        }
        foreach (InvocationExpressionSyntax call in root.DescendantNodes().OfType<InvocationExpressionSyntax>())
        {
            cancellationToken.ThrowIfCancellationRequested();
            Mapped(call, model, file, repositoryRoot, endpoints, cancellationToken);
        }
        return endpoints;
    }

    private static void Controller(TypeDeclarationSyntax type, SemanticModel model, string file, TokenConventions conventions,
        List<ScanHttpEndpoint> endpoints, CancellationToken cancellationToken)
    {
        if (ControllerRoutes(type, model, cancellationToken) is not { } routes || ClassPrefixes(routes, cancellationToken) is not { } prefixes) return;
        string? controller = ControllerName(type, conventions);
        foreach (MethodDeclarationSyntax action in type.Members.OfType<MethodDeclarationSyntax>())
        {
            if (!IsAction(action, model, cancellationToken) || Selectors(action, model, cancellationToken) is not { } selectors) continue;
            string operation = OperationId.Of(file, action);
            string? actionName = ActionName(action, model, conventions, cancellationToken);
            foreach ((string method, string template) in Routes(prefixes, selectors))
            {
                if (Tokens(template, controller, actionName) is string path && HttpRoutes.Endpoint(path) is ScanHttpSegment[] segments)
                    endpoints.Add(new ScanHttpEndpoint(operation, method, segments));
            }
        }
    }

    /// <summary>Each method and template an action serves: every route it declares under every class prefix.</summary>
    private static IEnumerable<(string Method, string Template)> Routes(List<string> prefixes, List<Selector> selectors)
    {
        foreach (string prefix in prefixes.Count == 0 ? [""] : prefixes)
        {
            // Without a class prefix, an action needs its own template to be routable.
            foreach (Selector selector in selectors.Where(selector => prefix.Length > 0 || selector.Template.Length > 0))
            {
                foreach (string method in selector.Methods) yield return (method, HttpRoutes.Join(prefix, selector.Template));
            }
        }
    }

    /// <summary>
    /// ASP.NET Core's controller rule as far as source shows it: a public, top-level, non-generic, non-abstract class
    /// declared in one place, named *Controller, marked [Controller] or deriving from ControllerBase or Controller, and
    /// not [NonController], counting attributes its bases carry. A controller also serves its bases' public methods, so a
    /// base between it and ControllerBase that declares one, or that the source does not declare, leaves its routes
    /// unknown. Its class routes are the [Route] attributes of the most derived class that declares any, as MVC reads
    /// them, each with the semantic model of the file declaring it. Null when the type is not such a controller.
    /// </summary>
    private static List<(AttributeSyntax Attribute, SemanticModel Model)>? ControllerRoutes(TypeDeclarationSyntax type, SemanticModel model, CancellationToken cancellationToken)
    {
        if (model.GetDeclaredSymbol(type, cancellationToken) is not INamedTypeSymbol
            {
                TypeKind: TypeKind.Class, DeclaredAccessibility: Accessibility.Public, IsAbstract: false, IsGenericType: false,
                ContainingType: null, DeclaringSyntaxReferences.Length: 1,
            } symbol) return null;
        List<string> attributes = [.. Attributes(type)];
        List<(AttributeSyntax Attribute, SemanticModel Model)> routes = [.. RouteAttributes(type).Select(attribute => (attribute, model))];
        bool framework = false;
        for (INamedTypeSymbol? inherited = symbol.BaseType; inherited is { SpecialType: not SpecialType.System_Object }; inherited = inherited.BaseType)
        {
            if (inherited.Name is "ControllerBase" or "Controller")
            {
                framework = true;
                break;
            }
            if (inherited.DeclaringSyntaxReferences.IsEmpty || inherited.GetMembers().OfType<IMethodSymbol>()
                .Any(method => method is { MethodKind: MethodKind.Ordinary, DeclaredAccessibility: Accessibility.Public, IsStatic: false })) return null;
            TypeDeclarationSyntax[] parts = [.. inherited.DeclaringSyntaxReferences.Select(part => part.GetSyntax(cancellationToken)).OfType<TypeDeclarationSyntax>()];
            attributes.AddRange(parts.SelectMany(Attributes));
            if (routes.Count == 0)
                routes.AddRange(parts.SelectMany(part => RouteAttributes(part).Select(attribute => (attribute, ModelOf(part.SyntaxTree, model.Compilation)))));
        }
        if (attributes.Contains("NonController")) return null;
        return framework || attributes.Contains("Controller") || symbol.Name.EndsWith("Controller", StringComparison.OrdinalIgnoreCase) ? routes : null;
    }

    private static IEnumerable<AttributeSyntax> RouteAttributes(TypeDeclarationSyntax type) =>
        type.AttributeLists.SelectMany(list => list.Attributes).Where(attribute => HttpSyntax.AttributeName(attribute) == "Route");

    /// <summary>A base may be declared in a referenced project, whose own compilation binds its constants.</summary>
    private static SemanticModel ModelOf(SyntaxTree tree, Compilation compilation) => compilation.ContainsSyntaxTree(tree)
        ? compilation.GetSemanticModel(tree)
        : compilation.References.OfType<CompilationReference>().Select(reference => reference.Compilation)
            .First(referenced => referenced.ContainsSyntaxTree(tree)).GetSemanticModel(tree);

    private static IEnumerable<string> Attributes(TypeDeclarationSyntax type) =>
        type.AttributeLists.SelectMany(list => list.Attributes).Select(HttpSyntax.AttributeName);

    /// <summary>ASP.NET Core's action rule: a public instance method with a body, not generic and not [NonAction].</summary>
    private static bool IsAction(MethodDeclarationSyntax action, SemanticModel model, CancellationToken cancellationToken) =>
        (action.Body is not null || action.ExpressionBody is not null)
        && model.GetDeclaredSymbol(action, cancellationToken) is IMethodSymbol
            { DeclaredAccessibility: Accessibility.Public, IsStatic: false, IsGenericMethod: false }
        && !action.AttributeLists.SelectMany(list => list.Attributes).Any(attribute => HttpSyntax.AttributeName(attribute) == "NonAction");

    /// <summary>
    /// The name [controller] stands for: the class name without its Controller suffix. Null when a token transformer
    /// rewrites it.
    /// </summary>
    private static string? ControllerName(TypeDeclarationSyntax type, TokenConventions conventions)
    {
        if (conventions.TransformsTokens) return null;
        string name = type.Identifier.ValueText;
        return name.EndsWith("Controller", StringComparison.OrdinalIgnoreCase) ? name[..^"Controller".Length] : name;
    }

    /// <summary>
    /// The name [action] stands for: a literal [ActionName], or else the method name without a trailing Async, which
    /// ASP.NET Core drops by default. Null when a token transformer rewrites it, when [ActionName] is not a constant
    /// the compilation proves, or when the source may keep the suffix and the name ends with Async.
    /// </summary>
    private static string? ActionName(MethodDeclarationSyntax action, SemanticModel model, TokenConventions conventions, CancellationToken cancellationToken)
    {
        if (conventions.TransformsTokens) return null;
        AttributeSyntax? named = action.AttributeLists.SelectMany(list => list.Attributes)
            .FirstOrDefault(attribute => HttpSyntax.AttributeName(attribute) == "ActionName");
        if (named is not null) return HttpSyntax.Constant(model, HttpSyntax.Argument(named), cancellationToken);
        string name = action.Identifier.ValueText;
        if (!name.EndsWith("Async", StringComparison.Ordinal)) return name;
        return conventions.KeepsAsyncSuffix ? null : name[..^"Async".Length];
    }

    /// <summary>
    /// Class-level route prefixes, rooted like an action template, or null when one is computed and hides every
    /// action's path.
    /// </summary>
    private static List<string>? ClassPrefixes(List<(AttributeSyntax Attribute, SemanticModel Model)> routes, CancellationToken cancellationToken)
    {
        List<string> prefixes = [];
        foreach ((AttributeSyntax attribute, SemanticModel model) in routes)
        {
            if (HttpSyntax.Constant(model, HttpSyntax.Argument(attribute), cancellationToken) is not string text) return null;
            prefixes.Add(HttpRoutes.Join("", text));
        }
        return prefixes;
    }

    /// <summary>One route of an action: the methods it allows, * for every method, on a template under the class prefix.</summary>
    private sealed record Selector(IReadOnlyList<string> Methods, string Template);

    /// <summary>
    /// The routes ASP.NET Core builds from an action's attributes. Each [Route] and each verb attribute with a
    /// template, Name or Order is one route: a verb attribute's route allows only its method, while a [Route] takes the
    /// methods of the template-less verb attributes. Those form one more route on the class prefix unless a [Route]
    /// took them. Null when a template is computed or [AcceptVerbs] states methods the scanner does not read.
    /// </summary>
    private static List<Selector>? Selectors(MethodDeclarationSyntax action, SemanticModel model, CancellationToken cancellationToken)
    {
        AttributeSyntax[] attributes = [.. action.AttributeLists.SelectMany(list => list.Attributes)];
        if (attributes.Any(attribute => HttpSyntax.AttributeName(attribute) == "AcceptVerbs")) return null;
        List<(string? Method, string Template)> routes = [];
        List<string> templatelessMethods = [];
        foreach (AttributeSyntax attribute in attributes.Where(IsRouting))
        {
            string? method = ActionVerbs.GetValueOrDefault(HttpSyntax.AttributeName(attribute));
            if (method is not null && HttpSyntax.Argument(attribute) is null && !DefinesRoute(attribute)) templatelessMethods.Add(method);
            else if (Template(attribute, model, cancellationToken) is string template) routes.Add((method, template));
            else return null;
        }
        List<string> routeMethods = templatelessMethods.Count > 0 ? templatelessMethods : ["*"];
        List<Selector> selectors = [.. routes.Select(route => new Selector(route.Method is null ? routeMethods : [route.Method], route.Template))];
        if (templatelessMethods.Count > 0 && routes.All(route => route.Method is not null)) selectors.Add(new Selector(templatelessMethods, ""));
        return selectors;
    }

    private static bool IsRouting(AttributeSyntax attribute) =>
        HttpSyntax.AttributeName(attribute) is var name && (name == "Route" || ActionVerbs.ContainsKey(name));

    /// <summary>A routing attribute's template: empty when it states none, null when it is computed.</summary>
    private static string? Template(AttributeSyntax attribute, SemanticModel model, CancellationToken cancellationToken) =>
        HttpSyntax.Argument(attribute) is ExpressionSyntax template ? HttpSyntax.Constant(model, template, cancellationToken) : "";

    /// <summary>A Name or Order makes a verb attribute define its own route even without a template.</summary>
    private static bool DefinesRoute(AttributeSyntax attribute) => attribute.ArgumentList?.Arguments
        .Any(argument => argument.NameEquals?.Name.Identifier.ValueText is "Name" or "Order") == true;

    /// <summary>
    /// Replaces the route tokens ASP.NET Core fills in. Any other token, or a token whose value the source does not
    /// prove, leaves the path unknown.
    /// </summary>
    private static string? Tokens(string path, string? controller, string? action)
    {
        if (controller is not null) path = path.Replace("[controller]", controller, StringComparison.OrdinalIgnoreCase);
        if (action is not null) path = path.Replace("[action]", action, StringComparison.OrdinalIgnoreCase);
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
            // Building or creating the application starts at its root; other fluent calls keep the same builder.
            if (name == "Build" || (name == "Create" && HttpSyntax.Receiver(call) is ExpressionSyntax receiver
                && HttpSyntax.CallName(receiver) == "WebApplication")) return "";
            if (name != "MapGroup") return Prefix(HttpSyntax.Receiver(call), model, depth + 1, cancellationToken);
            string? parent = Prefix(HttpSyntax.Receiver(call), model, depth + 1, cancellationToken);
            string? pattern = call.ArgumentList.Arguments.Count == 0 ? null
                : HttpSyntax.Constant(model, call.ArgumentList.Arguments[0].Expression, cancellationToken);
            return parent is null || pattern is null ? null : HttpRoutes.Under(parent, pattern);
        }
        if (builder is MemberAccessExpressionSyntax access) return Prefix(access.Name, model, depth + 1, cancellationToken);
        if (builder is not SimpleNameSyntax) return null;
        // A name that holds one value carries that value's prefix; any name declared as a WebApplication is the root.
        if (HttpSyntax.SingleValue(model, builder, cancellationToken) is ExpressionSyntax value) return Prefix(value, model, depth + 1, cancellationToken);
        return HttpSyntax.DeclaredTypeName(model.GetSymbolInfo(builder, cancellationToken).Symbol) == "WebApplication" ? "" : null;
    }
}
