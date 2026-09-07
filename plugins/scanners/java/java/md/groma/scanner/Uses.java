package md.groma.scanner;

import com.sun.source.tree.*;
import com.sun.source.util.TreePath;
import com.sun.source.util.TreePathScanner;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;
import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.Modifier;

/** Binding is not runtime dispatch. Unknown receivers never become guessed providers. */
final class Uses extends TreePathScanner<Void, String> {
    private final Declarations index;
    private final TreeSet<String> references = new TreeSet<>();
    final List<Object> invocations = new ArrayList<>();
    private int unresolved;
    private int methodReferences;

    Uses(Declarations index) { this.index = index; }

    @Override public Void scan(Tree tree, String caller) {
        if (tree == null || !index.authored.contains(tree)) return null;
        return super.scan(tree, index.operationAt.getOrDefault(tree, caller));
    }

    @Override public Void visitClass(ClassTree tree, String caller) {
        return super.visitClass(tree, null);
    }

    @Override public Void visitImport(ImportTree tree, String caller) { return null; }

    @Override public Void visitIdentifier(IdentifierTree tree, String caller) {
        reference();
        return super.visitIdentifier(tree, caller);
    }

    @Override public Void visitMemberSelect(MemberSelectTree tree, String caller) {
        reference();
        return super.visitMemberSelect(tree, caller);
    }

    @Override public Void visitMemberReference(MemberReferenceTree tree, String caller) {
        methodReferences++;
        reference();
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
        String target = exact ? index.operationFor.get(element) : null;
        if (target == null) unresolved++;
        var unit = getCurrentPath().getCompilationUnit();
        long line = unit.getLineMap().getLineNumber(index.trees.getSourcePositions().getStartPosition(unit, tree));
        invocations.add(Json.object("source", caller, "targets", target == null ? List.of() : List.of(target),
            "unresolved", target == null, "line", line, "member", member));
    }

    private void reference() {
        var element = index.trees.getElement(getCurrentPath());
        if (element == null) return;
        var declaration = index.trees.getPath(element);
        if (declaration == null) return;
        String source = index.file(getCurrentPath().getCompilationUnit());
        String target = index.file(declaration.getCompilationUnit());
        if (!source.equals(target) && index.containsFile(target)) references.add(source + "\0" + target);
    }

    List<Object> relationships() {
        return references.stream().map(pair -> {
            int separator = pair.indexOf('\0');
            return (Object) Json.object("source", pair.substring(0, separator), "target", pair.substring(separator + 1), "kind", "java:symbol-reference");
        }).toList();
    }

    List<Object> diagnostics() {
        return List.of(
            Json.object("severity", "info", "code", "JAVA_SOURCE_SET", "message",
                "Explicit source set only. No build evaluation, annotation processing, synthetic declarations, callback binding or runtime dispatch inference."),
            Json.object("severity", "info", "code", "JAVA_UNRESOLVED_CALLS", "message",
                unresolved + " calls have no supported source implementation target (virtual dispatch, external code or generated declarations)."),
            Json.object("severity", "info", "code", "JAVA_METHOD_REFERENCES", "message",
                methodReferences + " deferred method references are source references, not invocations."));
    }
}
