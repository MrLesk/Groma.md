package md.groma.scanner;

import com.sun.source.tree.*;
import com.sun.source.util.TreePath;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.Trees;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import javax.lang.model.element.Element;

/** A sent OkHttp call whose client, request builder and URL are visible in source. */
final class OkHttpRequests extends TreePathScanner<Void, Void> {
    private static final Set<String> VERBS = Set.of("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD");
    final List<Object> requests = new ArrayList<>();
    private final Declarations index;
    private final Trees trees;
    private final Set<Element> assigned;
    private final Set<String> imports = new HashSet<>();

    OkHttpRequests(Declarations index, Trees trees, Set<Element> assigned) {
        this.index = index;
        this.trees = trees;
        this.assigned = assigned;
    }

    @Override public Void visitCompilationUnit(CompilationUnitTree unit, Void unused) {
        imports.clear();
        for (var statement : unit.getImports()) imports.add(statement.getQualifiedIdentifier().toString());
        return super.visitCompilationUnit(unit, unused);
    }

    @Override public Void visitMethodInvocation(MethodInvocationTree call, Void unused) {
        if (call.getMethodSelect() instanceof MemberSelectTree select && select.getIdentifier().contentEquals("newCall")
            && call.getArguments().size() == 1 && sent(getCurrentPath()) && client(getCurrentPath(), select)) {
            var request = builder(new TreePath(getCurrentPath(), call.getArguments().get(0)));
            if (request != null) {
                var operation = operation();
                if (operation != null) {
                    var fact = Json.object("operation", operation, "method", request.verb());
                    HttpPaths.applyUrl(fact, request.url());
                    requests.add(fact);
                }
            }
        }
        return super.visitMethodInvocation(call, unused);
    }

    private static boolean sent(TreePath path) {
        var parent = path.getParentPath();
        if (parent == null || !(parent.getLeaf() instanceof MemberSelectTree select) || select.getExpression() != path.getLeaf()) return false;
        var call = parent.getParentPath();
        if (call == null || !(call.getLeaf() instanceof MethodInvocationTree)) return false;
        var name = select.getIdentifier().toString();
        return name.equals("execute") || name.equals("enqueue");
    }

    private boolean client(TreePath path, MemberSelectTree select) {
        var receiver = select.getExpression();
        if (receiver instanceof NewClassTree created) return okHttpType(created.getIdentifier().toString());
        var element = trees.getElement(new TreePath(new TreePath(path, select), receiver));
        var declaration = element == null ? null : trees.getPath(element);
        return declaration != null && declaration.getLeaf() instanceof VariableTree variable
            && okHttpType(variable.getType().toString());
    }

    private boolean okHttpType(String name) {
        return name.equals("okhttp3.OkHttpClient") || name.equals("OkHttpClient") && imports.contains("okhttp3.OkHttpClient");
    }

    private record Request(List<HttpPaths.Part> url, String verb) {}

    private Request builder(TreePath path) {
        if (path.getLeaf() instanceof IdentifierTree || path.getLeaf() instanceof MemberSelectTree) {
            var element = trees.getElement(path);
            if (element == null || assigned.contains(element)) return null;
            var declaration = trees.getPath(element);
            if (declaration == null || !(declaration.getLeaf() instanceof VariableTree variable)
                || variable.getInitializer() == null) return null;
            path = new TreePath(declaration, variable.getInitializer());
        }
        if (!(path.getLeaf() instanceof MethodInvocationTree top)
            || !(top.getMethodSelect() instanceof MemberSelectTree select)
            || !select.getIdentifier().contentEquals("build") || !top.getArguments().isEmpty()) return null;
        List<HttpPaths.Part> url = null;
        String verb = null;
        while (path.getLeaf() instanceof MethodInvocationTree call && call.getMethodSelect() instanceof MemberSelectTree method) {
            var name = method.getIdentifier().toString();
            if (name.equals("url") && url == null && !call.getArguments().isEmpty()) {
                url = HttpPaths.urlParts(new TreePath(path, call.getArguments().get(0)), trees, assigned);
            } else if (name.equals("method") && verb == null) {
                if (call.getArguments().isEmpty()) return null;
                verb = HttpPaths.literalText(new TreePath(path, call.getArguments().get(0)), trees);
                if (verb == null || !verb.matches("[A-Z]+")) return null;
            } else if (verb == null && VERBS.contains(name.toUpperCase(Locale.ROOT))) {
                verb = name.toUpperCase(Locale.ROOT);
            }
            var source = method.getExpression();
            if (source instanceof NewClassTree created) {
                if (url == null || !requestBuilderType(created.getIdentifier().toString())) return null;
                return new Request(url, verb == null ? "GET" : verb);
            }
            path = new TreePath(new TreePath(path, method), source);
        }
        return null;
    }

    private boolean requestBuilderType(String name) {
        return name.equals("okhttp3.Request.Builder") || name.equals("Request.Builder") && imports.contains("okhttp3.Request");
    }

    private String operation() {
        for (var path = getCurrentPath(); path != null; path = path.getParentPath()) {
            var id = index.operationAt.get(path.getLeaf());
            if (id != null) return id;
        }
        return null;
    }
}
