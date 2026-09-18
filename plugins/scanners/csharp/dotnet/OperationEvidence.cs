using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Operations;

namespace Groma.CSharpScanner;

/// <summary>Explicit source calls only. Runtime receiver/value flow is deliberately unresolved.</summary>
internal sealed class OperationEvidence(string repositoryRoot)
{
    private readonly Dictionary<string, ScanOperation> operations = new(StringComparer.Ordinal);
    private readonly List<PendingInvocation> invocations = [];

    public IEnumerable<ScanOperation> Operations => operations.Values;

    public IEnumerable<ScanInvocation> Invocations => invocations.Select(pending =>
    {
        string[] targets = pending.Target is not null && operations.ContainsKey(pending.Target)
            ? [pending.Target] : [];
        return new ScanInvocation(pending.Source, targets, pending.Unresolved || targets.Length == 0, pending.Line, pending.Member);
    });

    /// <summary>Extracts this file's operations and calls, and returns the operation each node belongs to.</summary>
    public IReadOnlyDictionary<SyntaxNode, string> Extract(SyntaxNode root, SemanticModel model, string file, CancellationToken cancellationToken)
    {
        Dictionary<SyntaxNode, string> callers = new();
        foreach (SyntaxNode node in root.DescendantNodesAndSelf())
        {
            cancellationToken.ThrowIfCancellationRequested();
            IMethodSymbol? method = ExecutableMethod(node, model, cancellationToken);
            if (method is null) continue;
            string id = OperationId.Of(file, node);
            operations.TryAdd(id, ScanOperationOf(id, file, node, method, model, cancellationToken));
            callers.Add(node, id);
        }
        if (root is CompilationUnitSyntax unit && unit.Members.OfType<GlobalStatementSyntax>().Any())
        {
            string id = OperationId.Of(file, root);
            operations.TryAdd(id, new ScanOperation(id, file, "<top-level>"));
            callers.Add(root, id);
        }
        foreach (SyntaxNode node in root.DescendantNodes().Where(IsExplicitCall))
        {
            cancellationToken.ThrowIfCancellationRequested();
            string? caller = Caller(node, callers);
            if (caller is null) continue;
            IOperation? operation = model.GetOperation(node, cancellationToken);
            if (operation is not (IInvocationOperation or IObjectCreationOperation or IDynamicInvocationOperation or IDynamicObjectCreationOperation or IFunctionPointerInvocationOperation or IInvalidOperation)) continue;
            (IMethodSymbol? target, bool unresolved) = Target(operation);
            if (model.GetDiagnostics(node.Span, cancellationToken).Any(diagnostic => diagnostic.Severity == DiagnosticSeverity.Error))
                (target, unresolved) = (null, true);
            string? targetId = OperationId.OfMethod(repositoryRoot, target);
            string? member = target?.Name ?? (node is InvocationExpressionSyntax call ? CallName(call.Expression) : null);
            invocations.Add(new PendingInvocation(caller, targetId, unresolved,
                node.GetLocation().GetLineSpan().StartLinePosition.Line + 1, member));
        }
        return callers;
    }

    /// <summary>Named operations carry the source range and tokens core compares; lambdas and anonymous methods do not.</summary>
    private static ScanOperation ScanOperationOf(string id, string file, SyntaxNode node, IMethodSymbol method, SemanticModel model, CancellationToken cancellationToken)
    {
        string name = method.ToDisplayString(SymbolDisplayFormat.CSharpErrorMessageFormat);
        if (node is AnonymousFunctionExpressionSyntax) return new ScanOperation(id, file, name);
        FileLinePositionSpan lines = node.GetLocation().GetLineSpan();
        return new ScanOperation(id, file, name, lines.StartLinePosition.Line + 1, lines.EndLinePosition.Line + 1, OperationTokens.Of(node, method, model, cancellationToken));
    }

    private static IMethodSymbol? ExecutableMethod(SyntaxNode node, SemanticModel model, CancellationToken token) => node switch
    {
        BaseMethodDeclarationSyntax declaration when declaration.Body is not null || declaration.ExpressionBody is not null => model.GetDeclaredSymbol(declaration, token) as IMethodSymbol,
        AccessorDeclarationSyntax accessor when accessor.Body is not null || accessor.ExpressionBody is not null => model.GetDeclaredSymbol(accessor, token) as IMethodSymbol,
        LocalFunctionStatementSyntax local => model.GetDeclaredSymbol(local, token) as IMethodSymbol,
        AnonymousFunctionExpressionSyntax lambda when !IsExpressionTree(lambda, model, token) => (model.GetOperation(lambda, token) as IAnonymousFunctionOperation)?.Symbol,
        ArrowExpressionClauseSyntax arrow when arrow.Parent is PropertyDeclarationSyntax property => (model.GetDeclaredSymbol(property, token) as IPropertySymbol)?.GetMethod,
        ArrowExpressionClauseSyntax arrow when arrow.Parent is IndexerDeclarationSyntax indexer => (model.GetDeclaredSymbol(indexer, token) as IPropertySymbol)?.GetMethod,
        _ => null,
    };

    private static bool IsExpressionTree(AnonymousFunctionExpressionSyntax lambda, SemanticModel model, CancellationToken token)
    {
        ITypeSymbol? converted = model.GetTypeInfo(lambda, token).ConvertedType;
        INamedTypeSymbol? expression = model.Compilation.GetTypeByMetadataName("System.Linq.Expressions.Expression`1");
        return expression is not null && SymbolEqualityComparer.Default.Equals(converted?.OriginalDefinition, expression);
    }

    private static bool IsExplicitCall(SyntaxNode node) =>
        node is InvocationExpressionSyntax or BaseObjectCreationExpressionSyntax or ConstructorInitializerSyntax;

    /// <summary>The operation whose code contains this node; an initializer outside any operation has none.</summary>
    internal static string? Caller(SyntaxNode node, IReadOnlyDictionary<SyntaxNode, string> callers)
    {
        foreach (SyntaxNode ancestor in node.Ancestors())
        {
            if (callers.TryGetValue(ancestor, out string? caller)) return caller;
            // Do not attribute field/property initializers to a top-level entry point.
            if (ancestor is AnonymousFunctionExpressionSyntax or LocalFunctionStatementSyntax || ancestor is MemberDeclarationSyntax and not GlobalStatementSyntax) return null;
        }
        return null;
    }

    private static (IMethodSymbol? Target, bool Unresolved) Target(IOperation? operation) => operation switch
    {
        IInvocationOperation invocation => (invocation.TargetMethod,
            invocation.TargetMethod.MethodKind == MethodKind.DelegateInvoke || invocation.TargetMethod.IsAbstract ||
            invocation.TargetMethod.ContainingType.TypeKind == TypeKind.Interface ||
            (invocation.IsVirtual && !invocation.TargetMethod.IsSealed && !invocation.TargetMethod.ContainingType.IsSealed)),
        IObjectCreationOperation creation => (creation.Constructor, false),
        _ => (null, true),
    };

    /// <summary>The name a call or member access uses, or null when the expression names nothing.</summary>
    internal static string? CallName(ExpressionSyntax expression) => expression switch
    {
        MemberAccessExpressionSyntax access => access.Name.Identifier.ValueText,
        MemberBindingExpressionSyntax binding => binding.Name.Identifier.ValueText,
        SimpleNameSyntax name => name.Identifier.ValueText,
        _ => null,
    };

    private sealed record PendingInvocation(string Source, string? Target, bool Unresolved, int Line, string? Member);
}
