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

    public void Extract(SyntaxNode root, SemanticModel model, string file, CancellationToken cancellationToken)
    {
        Dictionary<SyntaxNode, string> callers = new();
        foreach (SyntaxNode node in root.DescendantNodesAndSelf())
        {
            cancellationToken.ThrowIfCancellationRequested();
            IMethodSymbol? method = ExecutableMethod(node, model, cancellationToken);
            if (method is null) continue;
            string id = NodeId(file, node);
            operations.TryAdd(id, new ScanOperation(id, file, method.ToDisplayString(SymbolDisplayFormat.CSharpErrorMessageFormat)));
            callers.Add(node, id);
        }
        if (root is CompilationUnitSyntax unit && unit.Members.OfType<GlobalStatementSyntax>().Any())
        {
            string id = NodeId(file, root);
            operations.TryAdd(id, new ScanOperation(id, file, "<top-level>"));
            callers.Add(root, id);
        }
        foreach (SyntaxNode node in root.DescendantNodes().Where(IsExplicitCall))
        {
            cancellationToken.ThrowIfCancellationRequested();
            string? caller = FindCaller(node, callers);
            if (caller is null) continue;
            IOperation? operation = model.GetOperation(node, cancellationToken);
            if (operation is not (IInvocationOperation or IObjectCreationOperation or IDynamicInvocationOperation or IDynamicObjectCreationOperation or IFunctionPointerInvocationOperation)) continue;
            (IMethodSymbol? target, bool unresolved) = Target(operation);
            string? targetId = ImplementationId(target);
            string? member = target?.Name ?? (node is InvocationExpressionSyntax call ? CallName(call.Expression) : null);
            invocations.Add(new PendingInvocation(caller, targetId, unresolved,
                node.GetLocation().GetLineSpan().StartLinePosition.Line + 1, member));
        }
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

    private static string? FindCaller(SyntaxNode node, Dictionary<SyntaxNode, string> callers)
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

    private string? ImplementationId(IMethodSymbol? method)
    {
        if (method is null || method.MethodKind == MethodKind.DelegateInvoke) return null;
        method = (method.ReducedFrom ?? method).OriginalDefinition;
        method = method.PartialImplementationPart ?? method;
        foreach (SyntaxReference declaration in method.DeclaringSyntaxReferences)
        {
            SyntaxNode syntax = declaration.GetSyntax();
            if (!Path.IsPathRooted(syntax.SyntaxTree.FilePath)) return null;
            string file = SourcePath.Relative(repositoryRoot, syntax.SyntaxTree.FilePath);
            string id = NodeId(file, syntax);
            // Expression-bodied property getters point to the property declaration.
            if (syntax is PropertyDeclarationSyntax { ExpressionBody: not null } property) id = NodeId(file, property.ExpressionBody);
            if (syntax is IndexerDeclarationSyntax { ExpressionBody: not null } indexer) id = NodeId(file, indexer.ExpressionBody);
            return id;
        }
        return null;
    }

    private static string NodeId(string file, SyntaxNode node) => $"operation:{file}:{node.SpanStart}:{node.RawKind}";

    private static string? CallName(ExpressionSyntax expression) => expression switch
    {
        MemberAccessExpressionSyntax access => access.Name.Identifier.ValueText,
        MemberBindingExpressionSyntax binding => binding.Name.Identifier.ValueText,
        SimpleNameSyntax name => name.Identifier.ValueText,
        _ => null,
    };

    private sealed record PendingInvocation(string Source, string? Target, bool Unresolved, int Line, string? Member);
}
