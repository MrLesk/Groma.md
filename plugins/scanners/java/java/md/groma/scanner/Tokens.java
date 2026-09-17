package md.groma.scanner;

import com.sun.source.tree.AssignmentTree;
import com.sun.source.tree.BinaryTree;
import com.sun.source.tree.BlockTree;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompoundAssignmentTree;
import com.sun.source.tree.ConditionalExpressionTree;
import com.sun.source.tree.IdentifierTree;
import com.sun.source.tree.LambdaExpressionTree;
import com.sun.source.tree.LiteralTree;
import com.sun.source.tree.MemberReferenceTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.tree.PrimitiveTypeTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.UnaryTree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreeScanner;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;

/**
 * Binding-normalized tokens of one method or constructor body. Names declared inside the body become
 * slots, so renaming a local does not change the tokens; every other name stays as written.
 */
final class Tokens extends TreeScanner<Void, Void> {
    private static final Map<Tree.Kind, String> OPERATORS = operators();
    private static final Map<Tree.Kind, String> KEYWORDS = keywords();

    private final List<Object> tokens = new ArrayList<>();
    private final Deque<Map<String, String>> scopes = new ArrayDeque<>();
    private final Set<Tree> authored;
    private int nextSlot;

    private Tokens(Set<Tree> authored) {
        this.authored = authored;
        scopes.push(new HashMap<>());
    }

    /** Compiler-inserted members, such as a default constructor, are not part of the authored body. */
    static List<Object> of(MethodTree method, Set<Tree> authored) {
        var reader = new Tokens(authored);
        for (var parameter : method.getParameters()) reader.declare(parameter.getName().toString());
        reader.scan(method.getBody(), null);
        return reader.tokens;
    }

    private String declare(String name) {
        var slot = "$" + nextSlot++;
        scopes.peek().put(name, slot);
        return slot;
    }

    private String slot(String name) {
        for (var scope : scopes) {
            var found = scope.get(name);
            if (found != null) return found;
        }
        return name;
    }

    @Override public Void scan(Tree tree, Void unused) {
        if (tree == null || !authored.contains(tree)) return null;
        var keyword = KEYWORDS.get(tree.getKind());
        if (keyword != null) tokens.add(keyword);
        return super.scan(tree, unused);
    }

    @Override public Void visitBlock(BlockTree tree, Void unused) {
        return scoped(() -> super.visitBlock(tree, unused));
    }

    @Override public Void visitVariable(VariableTree tree, Void unused) {
        scan(tree.getType(), unused);
        tokens.add(declare(tree.getName().toString()));
        if (tree.getInitializer() != null) {
            tokens.add("=");
            scan(tree.getInitializer(), unused);
        }
        return null;
    }

    @Override public Void visitPrimitiveType(PrimitiveTypeTree tree, Void unused) {
        tokens.add(tree.getPrimitiveTypeKind().name().toLowerCase(Locale.ROOT));
        return null;
    }

    @Override public Void visitIdentifier(IdentifierTree tree, Void unused) {
        tokens.add(slot(tree.getName().toString()));
        return null;
    }

    @Override public Void visitLiteral(LiteralTree tree, Void unused) {
        var value = tree.getValue();
        tokens.add(value instanceof String text ? Json.encode(text) : String.valueOf(value));
        return null;
    }

    @Override public Void visitMemberSelect(MemberSelectTree tree, Void unused) {
        scan(tree.getExpression(), unused);
        tokens.add("." + tree.getIdentifier());
        return null;
    }

    @Override public Void visitMemberReference(MemberReferenceTree tree, Void unused) {
        scan(tree.getQualifierExpression(), unused);
        tokens.add("::" + tree.getName());
        return null;
    }

    @Override public Void visitMethodInvocation(MethodInvocationTree tree, Void unused) {
        // An unqualified callee is a method name, even when a local shares it.
        if (tree.getMethodSelect() instanceof IdentifierTree callee) tokens.add(callee.getName().toString());
        else scan(tree.getMethodSelect(), unused);
        tokens.add("call");
        for (var argument : tree.getArguments()) scan(argument, unused);
        return null;
    }

    @Override public Void visitNewClass(NewClassTree tree, Void unused) {
        tokens.add("new");
        scan(tree.getIdentifier(), unused);
        tokens.add("call");
        for (var argument : tree.getArguments()) scan(argument, unused);
        scan(tree.getClassBody(), unused);
        return null;
    }

    @Override public Void visitClass(ClassTree tree, Void unused) {
        tokens.add("class");
        return scoped(() -> super.visitClass(tree, unused));
    }

    @Override public Void visitMethod(MethodTree tree, Void unused) {
        tokens.add("fn");
        return scoped(() -> {
            for (var parameter : tree.getParameters()) declare(parameter.getName().toString());
            scan(tree.getBody(), unused);
            return null;
        });
    }

    @Override public Void visitLambdaExpression(LambdaExpressionTree tree, Void unused) {
        tokens.add("fn");
        return scoped(() -> {
            for (var parameter : tree.getParameters()) declare(parameter.getName().toString());
            scan(tree.getBody(), unused);
            return null;
        });
    }

    @Override public Void visitBinary(BinaryTree tree, Void unused) {
        scan(tree.getLeftOperand(), unused);
        tokens.add(OPERATORS.getOrDefault(tree.getKind(), "op"));
        scan(tree.getRightOperand(), unused);
        return null;
    }

    @Override public Void visitUnary(UnaryTree tree, Void unused) {
        var operator = OPERATORS.getOrDefault(tree.getKind(), "op");
        if (tree.getKind().name().startsWith("POSTFIX")) {
            scan(tree.getExpression(), unused);
            tokens.add(operator);
            return null;
        }
        tokens.add(operator);
        return scan(tree.getExpression(), unused);
    }

    @Override public Void visitAssignment(AssignmentTree tree, Void unused) {
        scan(tree.getVariable(), unused);
        tokens.add("=");
        return scan(tree.getExpression(), unused);
    }

    @Override public Void visitCompoundAssignment(CompoundAssignmentTree tree, Void unused) {
        scan(tree.getVariable(), unused);
        tokens.add(OPERATORS.getOrDefault(tree.getKind(), "op"));
        return scan(tree.getExpression(), unused);
    }

    @Override public Void visitConditionalExpression(ConditionalExpressionTree tree, Void unused) {
        scan(tree.getCondition(), unused);
        tokens.add("?");
        scan(tree.getTrueExpression(), unused);
        tokens.add(":");
        return scan(tree.getFalseExpression(), unused);
    }

    private Void scoped(Supplier<Void> body) {
        scopes.push(new HashMap<>());
        try { return body.get(); } finally { scopes.pop(); }
    }

    private static Map<Tree.Kind, String> operators() {
        return Map.ofEntries(
            Map.entry(Tree.Kind.PLUS, "+"), Map.entry(Tree.Kind.PLUS_ASSIGNMENT, "+="),
            Map.entry(Tree.Kind.MINUS, "-"), Map.entry(Tree.Kind.MINUS_ASSIGNMENT, "-="),
            Map.entry(Tree.Kind.MULTIPLY, "*"), Map.entry(Tree.Kind.MULTIPLY_ASSIGNMENT, "*="),
            Map.entry(Tree.Kind.DIVIDE, "/"), Map.entry(Tree.Kind.DIVIDE_ASSIGNMENT, "/="),
            Map.entry(Tree.Kind.REMAINDER, "%"), Map.entry(Tree.Kind.REMAINDER_ASSIGNMENT, "%="),
            Map.entry(Tree.Kind.AND, "&"), Map.entry(Tree.Kind.AND_ASSIGNMENT, "&="),
            Map.entry(Tree.Kind.OR, "|"), Map.entry(Tree.Kind.OR_ASSIGNMENT, "|="),
            Map.entry(Tree.Kind.XOR, "^"), Map.entry(Tree.Kind.XOR_ASSIGNMENT, "^="),
            Map.entry(Tree.Kind.LEFT_SHIFT, "<<"), Map.entry(Tree.Kind.LEFT_SHIFT_ASSIGNMENT, "<<="),
            Map.entry(Tree.Kind.RIGHT_SHIFT, ">>"), Map.entry(Tree.Kind.RIGHT_SHIFT_ASSIGNMENT, ">>="),
            Map.entry(Tree.Kind.UNSIGNED_RIGHT_SHIFT, ">>>"), Map.entry(Tree.Kind.UNSIGNED_RIGHT_SHIFT_ASSIGNMENT, ">>>="),
            Map.entry(Tree.Kind.CONDITIONAL_AND, "&&"), Map.entry(Tree.Kind.CONDITIONAL_OR, "||"),
            Map.entry(Tree.Kind.LESS_THAN, "<"), Map.entry(Tree.Kind.GREATER_THAN, ">"),
            Map.entry(Tree.Kind.LESS_THAN_EQUAL, "<="), Map.entry(Tree.Kind.GREATER_THAN_EQUAL, ">="),
            Map.entry(Tree.Kind.EQUAL_TO, "=="), Map.entry(Tree.Kind.NOT_EQUAL_TO, "!="),
            Map.entry(Tree.Kind.UNARY_PLUS, "+"), Map.entry(Tree.Kind.UNARY_MINUS, "-"),
            Map.entry(Tree.Kind.BITWISE_COMPLEMENT, "~"), Map.entry(Tree.Kind.LOGICAL_COMPLEMENT, "!"),
            Map.entry(Tree.Kind.PREFIX_INCREMENT, "++"), Map.entry(Tree.Kind.PREFIX_DECREMENT, "--"),
            Map.entry(Tree.Kind.POSTFIX_INCREMENT, "++"), Map.entry(Tree.Kind.POSTFIX_DECREMENT, "--"));
    }

    /** Control flow and other structure keep one keyword each; the tree's children follow it. */
    private static Map<Tree.Kind, String> keywords() {
        return Map.ofEntries(
            Map.entry(Tree.Kind.IF, "if"), Map.entry(Tree.Kind.FOR_LOOP, "for"),
            Map.entry(Tree.Kind.ENHANCED_FOR_LOOP, "for"), Map.entry(Tree.Kind.WHILE_LOOP, "while"),
            Map.entry(Tree.Kind.DO_WHILE_LOOP, "do"), Map.entry(Tree.Kind.SWITCH, "switch"),
            Map.entry(Tree.Kind.SWITCH_EXPRESSION, "switch"), Map.entry(Tree.Kind.CASE, "case"),
            Map.entry(Tree.Kind.TRY, "try"), Map.entry(Tree.Kind.CATCH, "catch"),
            Map.entry(Tree.Kind.THROW, "throw"), Map.entry(Tree.Kind.RETURN, "return"),
            Map.entry(Tree.Kind.BREAK, "break"), Map.entry(Tree.Kind.CONTINUE, "continue"),
            Map.entry(Tree.Kind.SYNCHRONIZED, "synchronized"), Map.entry(Tree.Kind.ASSERT, "assert"),
            Map.entry(Tree.Kind.YIELD, "yield"), Map.entry(Tree.Kind.INSTANCE_OF, "instanceof"),
            Map.entry(Tree.Kind.TYPE_CAST, "cast"), Map.entry(Tree.Kind.NEW_ARRAY, "newarray"),
            Map.entry(Tree.Kind.ARRAY_ACCESS, "index"), Map.entry(Tree.Kind.LABELED_STATEMENT, "label"));
    }
}
