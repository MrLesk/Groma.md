package md.groma.scanner;

import com.sun.source.tree.*;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.Trees;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
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
            operation(tree, element.getEnclosingElement() + "#" + element);
            operationFor.put(element, operationAt.get(tree));
        }
        return super.visitMethod(tree, unused);
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
        String id = identity(tree);
        operationAt.put(tree, id);
        operations.add(Json.object("id", id, "file", file(getCurrentPath().getCompilationUnit()), "name", name));
    }

    private String identity(Tree tree) {
        var unit = getCurrentPath().getCompilationUnit();
        return file(unit) + "@" + trees.getSourcePositions().getStartPosition(unit, tree);
    }

    String file(CompilationUnitTree unit) {
        return root.relativize(Path.of(unit.getSourceFile().toUri())).toString().replace('\\', '/');
    }

    boolean containsFile(String file) { return symbols.containsKey(file); }

    List<Object> files() {
        return symbols.entrySet().stream().map(entry -> (Object) Json.object("file", entry.getKey(), "symbols", entry.getValue())).toList();
    }

    List<Object> placements() {
        return symbols.keySet().stream().map(file -> (Object) Json.object("file", file, "scope", "java:source-set")).toList();
    }
}
