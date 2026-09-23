package md.groma.scanner;

import com.sun.source.tree.AnnotationTree;
import com.sun.source.tree.AssignmentTree;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreePath;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.Trees;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Retrofit interface methods state requests through imported retrofit2.http annotations. */
final class RetrofitRequests extends TreePathScanner<Void, Void> {
    private static final Set<String> VERBS = Set.of("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS");
    final List<Object> requests = new ArrayList<>();
    private final Declarations index;
    private final Trees trees;
    private final Set<String> imports = new HashSet<>();

    RetrofitRequests(Declarations index, Trees trees) {
        this.index = index;
        this.trees = trees;
    }

    @Override public Void visitCompilationUnit(CompilationUnitTree unit, Void unused) {
        imports.clear();
        for (var statement : unit.getImports()) imports.add(statement.getQualifiedIdentifier().toString());
        return super.visitCompilationUnit(unit, unused);
    }

    @Override public Void visitClass(ClassTree tree, Void unused) {
        if (tree.getKind() == Tree.Kind.INTERFACE) {
            var type = getCurrentPath();
            for (var member : tree.getMembers()) {
                if (!(member instanceof MethodTree method)) continue;
                var path = new TreePath(type, method);
                for (var annotation : method.getModifiers().getAnnotations()) add(path, annotation);
            }
        }
        return super.visitClass(tree, unused);
    }

    private void add(TreePath method, AnnotationTree annotation) {
        var type = annotation.getAnnotationType().toString();
        var name = type.substring(type.lastIndexOf('.') + 1);
        if (!VERBS.contains(name) || !isRetrofit(type)) return;
        if (annotation.getArguments().size() != 1) return;
        ExpressionTree value = annotation.getArguments().get(0);
        if (value instanceof AssignmentTree assignment) {
            if (!assignment.getVariable().toString().equals("value")) return;
            value = assignment.getExpression();
        }
        var route = HttpPaths.literalText(new TreePath(method, value), trees);
        if (route == null || route.isEmpty()) return;
        var parts = new ArrayList<HttpPaths.Part>();
        parts.add(HttpPaths.Part.hole(true));
        parts.addAll(HttpPaths.templateParts(route));
        var fact = Json.object("operation", index.declareOperation(method), "method", name);
        HttpPaths.applyUrl(fact, parts);
        requests.add(fact);
    }

    private boolean isRetrofit(String type) {
        return type.startsWith("retrofit2.http.") || !type.contains(".")
            && (imports.contains("retrofit2.http." + type) || imports.contains("retrofit2.http.*"));
    }
}
