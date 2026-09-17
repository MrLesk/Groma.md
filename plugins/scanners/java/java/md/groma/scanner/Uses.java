package md.groma.scanner;

import com.sun.source.tree.*;
import com.sun.source.util.TreePath;
import com.sun.source.util.TreePathScanner;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.Modifier;
import javax.tools.Diagnostic;
import javax.tools.JavaFileObject;

/** Binding is not runtime dispatch. Unknown receivers never become guessed providers. */
final class Uses extends TreePathScanner<Void, String> {
    private final Declarations index;
    final List<Object> invocations = new ArrayList<>();
    private int unresolved;
    private int methodReferences;

    private final Map<java.net.URI, List<Diagnostic<? extends JavaFileObject>>> errors;

    Uses(Declarations index, List<Diagnostic<? extends JavaFileObject>> diagnostics) {
        this.index = index;
        this.errors = diagnostics.stream().filter(item -> item.getKind() == Diagnostic.Kind.ERROR && item.getSource() != null)
            .collect(Collectors.groupingBy(item -> item.getSource().toUri()));
    }

    @Override public Void scan(Tree tree, String caller) {
        if (tree == null || !index.authored.contains(tree)) return null;
        return super.scan(tree, index.operationAt.getOrDefault(tree, caller));
    }

    @Override public Void visitClass(ClassTree tree, String caller) {
        return super.visitClass(tree, null);
    }

    @Override public Void visitImport(ImportTree tree, String caller) { return null; }

    @Override public Void visitMemberReference(MemberReferenceTree tree, String caller) {
        methodReferences++;
        // Creating a method reference does not invoke it.
        return super.visitMemberReference(tree, caller);
    }

    @Override public Void visitMethodInvocation(MethodInvocationTree tree, String caller) {
        var element = index.trees.getElement(new TreePath(getCurrentPath(), tree.getMethodSelect()));
        String member = tree.getMethodSelect() instanceof MemberSelectTree select
            ? select.getIdentifier().toString() : tree.getMethodSelect().toString();
        invocation(tree, caller, element, exact(element, tree.getMethodSelect()), member);
        return super.visitMethodInvocation(tree, caller);
    }

    @Override public Void visitNewClass(NewClassTree tree, String caller) {
        var element = index.trees.getElement(getCurrentPath());
        invocation(tree, caller, element, true, "<init>");
        return super.visitNewClass(tree, caller);
    }

    private boolean exact(Element element, Tree select) {
        if (!(element instanceof ExecutableElement)) return false;
        if (element.getKind() == ElementKind.CONSTRUCTOR) return true;
        var flags = element.getModifiers();
        if (flags.contains(Modifier.STATIC) || flags.contains(Modifier.PRIVATE) || flags.contains(Modifier.FINAL)) return true;
        if (element.getEnclosingElement().getModifiers().contains(Modifier.FINAL)) return true;
        if (!(select instanceof MemberSelectTree member)) return false;
        var receiver = member.getExpression();
        if (receiver instanceof IdentifierTree name && name.getName().contentEquals("super")) return true;
        if (receiver instanceof MemberSelectTree name && name.getIdentifier().contentEquals("super")) return true;
        return receiver instanceof NewClassTree creation && creation.getClassBody() == null;
    }

    private void invocation(Tree tree, String caller, Element element, boolean exact, String member) {
        if (caller == null) return;
        String target = exact && !hasError(tree) ? index.operationFor.get(element) : null;
        if (target == null) unresolved++;
        var unit = getCurrentPath().getCompilationUnit();
        long line = unit.getLineMap().getLineNumber(index.trees.getSourcePositions().getStartPosition(unit, tree));
        invocations.add(Json.object("source", caller, "targets", target == null ? List.of() : List.of(target),
            "unresolved", target == null, "line", line, "member", member));
    }

    private boolean hasError(Tree tree) {
        var type = index.trees.getTypeMirror(getCurrentPath());
        if (type != null && type.getKind() == javax.lang.model.type.TypeKind.ERROR) return true;
        var unit = getCurrentPath().getCompilationUnit();
        long start = index.trees.getSourcePositions().getStartPosition(unit, tree);
        long end = index.trees.getSourcePositions().getEndPosition(unit, tree);
        return errors.getOrDefault(unit.getSourceFile().toUri(), List.of()).stream()
            .anyMatch(item -> item.getStartPosition() < end && item.getEndPosition() >= start);
    }

    List<Object> diagnostics() {
        return List.of(
            Json.object("severity", "info", "code", "JAVA_SOURCE_SET", "message",
                "Main sources only. No annotation processing, synthetic declarations, callback binding or framework runtime dispatch inference."),
            Json.object("severity", "info", "code", "JAVA_UNRESOLVED_CALLS", "message",
                unresolved + " calls have no supported source implementation target (virtual dispatch, external code or generated declarations)."),
            Json.object("severity", "info", "code", "JAVA_METHOD_REFERENCES", "message",
                methodReferences + " deferred method references are source references, not invocations."));
    }
}
