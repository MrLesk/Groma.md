package md.groma.scanner;

import com.sun.source.tree.*;
import com.sun.source.util.TreePath;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.Trees;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import javax.lang.model.element.Element;

/** Source-owned declarations only; javac-inserted constructors and accessors are excluded. */
final class Declarations extends TreePathScanner<Void, Void> {
    final Path root;
    final Trees trees;
    final Set<Tree> authored;
    final Map<Tree, String> operationAt = new IdentityHashMap<>();
    final Map<Element, String> operationFor = new HashMap<>();
    final List<Object> operations = new ArrayList<>();
    private final Map<String, List<Object>> symbols = new LinkedHashMap<>();
    private final Set<String> declared = new HashSet<>();

    Declarations(Path root, Trees trees, Set<Tree> authored) {
        this.root = root;
        this.trees = trees;
        this.authored = authored;
    }

    @Override public Void scan(Tree tree, Void unused) {
        if (tree == null || !authored.contains(tree)) return null;
        return super.scan(tree, unused);
    }

    @Override public Void visitCompilationUnit(CompilationUnitTree tree, Void unused) {
        symbols.put(file(tree), new ArrayList<>());
        return super.visitCompilationUnit(tree, unused);
    }

    @Override public Void visitClass(ClassTree tree, Void unused) {
        var element = trees.getElement(getCurrentPath());
        var name = tree.getSimpleName().toString();
        if (name.isEmpty()) name = "<anonymous>";
        var id = element == null || element.toString().isEmpty() ? identity(tree) : element.toString();
        symbols.get(file(getCurrentPath().getCompilationUnit())).add(Json.object(
            "id", id, "name", name, "kind", tree.getKind().name().toLowerCase(Locale.ROOT)));
        return super.visitClass(tree, unused);
    }

    @Override public Void visitMethod(MethodTree tree, Void unused) {
        if (tree.getBody() != null) {
            var element = trees.getElement(getCurrentPath());
            if (element == null) throw new IllegalStateException("Unbound executable declaration");
            // A method of an anonymous class, including an enum constant body, is an anonymous callback.
            operation(tree, element.getEnclosingElement() + "#" + element, anonymous() ? null : Tokens.of(getCurrentPath(), trees, authored));
            operationFor.put(element, operationAt.get(tree));
        }
        return super.visitMethod(tree, unused);
    }

    /** Only the declaring class decides: a named local class inside an anonymous body still declares names. */
    private boolean anonymous() {
        return getCurrentPath().getParentPath().getLeaf() instanceof ClassTree type && type.getSimpleName().isEmpty();
    }

    @Override public Void visitLambdaExpression(LambdaExpressionTree tree, Void unused) {
        operation(tree, "<lambda>");
        return super.visitLambdaExpression(tree, unused);
    }

    @Override public Void visitBlock(BlockTree tree, Void unused) {
        if (getCurrentPath().getParentPath().getLeaf() instanceof ClassTree) {
            operation(tree, tree.isStatic() ? "<static-initializer>" : "<instance-initializer>");
        }
        return super.visitBlock(tree, unused);
    }

    @Override public Void visitVariable(VariableTree tree, Void unused) {
        if (tree.getInitializer() != null && getCurrentPath().getParentPath().getLeaf() instanceof ClassTree) {
            operation(tree, "<initialize " + tree.getName() + ">");
        }
        return super.visitVariable(tree, unused);
    }

    private void operation(Tree tree, String name) {
        operation(tree, name, null);
    }

    /** Only an operation with tokens is compared as possible duplicate logic. */
    private void operation(Tree tree, String name, List<Object> tokens) {
        String id = identity(tree);
        var unit = getCurrentPath().getCompilationUnit();
        operationAt.put(tree, id);
        var fact = Json.object("id", id, "file", file(unit), "name", name);
        if (tokens != null) {
            var lines = unit.getLineMap();
            fact.put("startLine", lines.getLineNumber(trees.getSourcePositions().getStartPosition(unit, tree)));
            fact.put("endLine", lines.getLineNumber(trees.getSourcePositions().getEndPosition(unit, tree)));
            fact.put("tokens", tokens);
        }
        operations.add(fact);
    }

    /** A declarative client method has no body, so only its request declares it as an operation. */
    String declareOperation(TreePath path) {
        var unit = path.getCompilationUnit();
        var id = file(unit) + "@" + trees.getSourcePositions().getStartPosition(unit, path.getLeaf());
        if (!declared.add(id)) return id;
        var element = trees.getElement(path);
        var name = element == null ? path.getLeaf().toString() : element.getEnclosingElement() + "#" + element;
        operations.add(Json.object("id", id, "file", file(unit), "name", name));
        return id;
    }

    private String identity(Tree tree) {
        var unit = getCurrentPath().getCompilationUnit();
        return file(unit) + "@" + trees.getSourcePositions().getStartPosition(unit, tree);
    }

    String file(CompilationUnitTree unit) {
        return root.relativize(Path.of(unit.getSourceFile().toUri())).toString().replace('\\', '/');
    }

    List<Object> files() {
        return symbols.entrySet().stream().map(entry -> (Object) Json.object("file", entry.getKey(), "roots", List.of("java:source-set"), "symbols", entry.getValue())).toList();
    }

}
