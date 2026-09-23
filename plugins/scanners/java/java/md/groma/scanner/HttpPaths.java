package md.groma.scanner;

import com.sun.source.tree.AssignmentTree;
import com.sun.source.tree.BinaryTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.CompoundAssignmentTree;
import com.sun.source.tree.LiteralTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreePath;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.Trees;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.VariableElement;

/** Path patterns and request URLs the source proves, as the shared HTTP fact format. */
final class HttpPaths {
    private static final Pattern TEXT = Pattern.compile("[A-Za-z0-9\\-._~!$&'()*+,;=:@%]+");
    /** `{name}`, `{name:regex}` or `{*name}`, with the spaces a JAX-RS template allows. */
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\s*(\\*?)([^}:\\s]*)\\s*(:.*)?}");
    /**
     * Stands for route text the scanner sees but cannot read. It travels through prefix and route concatenation, and
     * since NUL is not URL path text, endpointSegments ends the route at its segment with a constrained optional
     * catch-all: a blocker that only possibly takes the requests below its readable prefix.
     */
    static final String UNREADABLE = "\u0000";
    /** One computed expression inside a URL; a configured value is one the scanner cannot see. */
    record Part(String text, boolean hole, boolean configured) {
        static Part text(String value) { return new Part(value, false, false); }
        static Part hole(boolean configured) { return new Part("", true, configured); }
    }

    private HttpPaths() {}

    /** Variables assigned after declaration cannot supply a source-proven initializer to a request. */
    static Set<Element> assignedVariables(Set<Tree> authored, Trees trees) {
        var assigned = new HashSet<Element>();
        var recorder = new TreePathScanner<Void, Void>() {
            @Override public Void visitAssignment(AssignmentTree tree, Void unused) {
                add(tree.getVariable());
                return super.visitAssignment(tree, unused);
            }

            @Override public Void visitCompoundAssignment(CompoundAssignmentTree tree, Void unused) {
                add(tree.getVariable());
                return super.visitCompoundAssignment(tree, unused);
            }

            private void add(com.sun.source.tree.ExpressionTree target) {
                var element = trees.getElement(new TreePath(getCurrentPath(), target));
                if (element != null) assigned.add(element);
            }
        };
        for (var tree : authored) if (tree instanceof CompilationUnitTree unit) recorder.scan(unit, null);
        return assigned;
    }

    /**
     * Segments of a Spring path pattern, or of a JAX-RS template when `jaxrs` is set. A segment that may span segments
     * or that the format cannot state, including Spring's `{*name}` and `**`, ends the path with a constrained optional
     * catch-all: it also matches no segment, and Spring ranks such a pattern after every other one, so core does not
     * rank it segment by segment against a conflicting route.
     */
    static List<Object> endpointSegments(String pattern, boolean jaxrs) {
        var segments = new ArrayList<Object>();
        for (var part : pattern.split("/")) {
            if (part.isEmpty()) continue;
            var segment = endpointSegment(part, jaxrs);
            if (segment == null) {
                segments.add(Json.object("kind", "catch-all", "name", placeholderName(part), "optional", true, "constrained", true));
                break;
            }
            segments.add(segment);
        }
        return segments;
    }

    /** One segment, or null when it may span segments or the format cannot state it. */
    private static Object endpointSegment(String part, boolean jaxrs) {
        // A `${...}` placeholder takes its text from configuration at startup.
        if (part.contains("${")) return null;
        var placeholder = PLACEHOLDER.matcher(part);
        var whole = placeholder.matches();
        var regex = part.matches(".*\\{[^}]*:.*");
        // A JAX-RS regular expression may match a slash, so it can take several segments.
        if (jaxrs && regex) return null;
        // Spring's `{*name}` and `**` take the rest of the path.
        if (whole && !placeholder.group(1).isEmpty() || !jaxrs && part.equals("**")) return null;
        if (whole) return parameter(placeholderName(part), regex);
        if (!jaxrs && part.equals("*")) return parameter("*", false);
        // Text mixed with a placeholder or a Spring wildcard accepts only some values of one segment.
        if (part.contains("{") || !jaxrs && (part.contains("*") || part.contains("?"))) return parameter(placeholderName(part), true);
        return TEXT.matcher(part).matches() ? Json.object("kind", "literal", "value", part) : null;
    }

    private static Object parameter(String name, boolean constrained) {
        var segment = Json.object("kind", "parameter", "name", name);
        if (constrained) segment.put("constrained", true);
        return segment;
    }

    /** The first placeholder's name in a segment, or `*` for a wildcard or a name outside URL path characters. */
    private static String placeholderName(String part) {
        var placeholder = PLACEHOLDER.matcher(part);
        return placeholder.find() && TEXT.matcher(placeholder.group(2)).matches() ? placeholder.group(2) : "*";
    }

    /** A declarative client route: each `{name}` placeholder is filled at runtime, so it is a hole. */
    static List<Part> templateParts(String route) {
        var parts = new ArrayList<Part>();
        var template = Pattern.compile("\\{[^}]*}").matcher(route);
        var read = 0;
        while (template.find()) {
            parts.add(Part.text(route.substring(read, template.start())));
            parts.add(Part.hole(false));
            read = template.end();
        }
        parts.add(Part.text(route.substring(read)));
        return parts;
    }

    /**
     * The parts of a URL expression: literal text, resolved constants and variables, and holes for the rest.
     * `assigned` holds the variables some statement assigns after their declaration.
     */
    static List<Part> urlParts(TreePath path, Trees trees, Set<Element> assigned) {
        var raw = new ArrayList<Part>();
        collect(path, trees, assigned, raw);
        // A `{name}` placeholder in a client URL is filled at runtime, as in a declarative route.
        var parts = new ArrayList<Part>();
        for (var part : raw) {
            if (part.hole()) parts.add(part);
            else parts.addAll(templateParts(part.text()));
        }
        return parts;
    }

    /** Without `assigned`, variables are not followed, so a variable's initializer is read one level deep. */
    private static void collect(TreePath path, Trees trees, Set<Element> assigned, List<Part> parts) {
        var tree = path.getLeaf();
        if (tree instanceof BinaryTree binary && tree.getKind() == Tree.Kind.PLUS) {
            collect(new TreePath(path, binary.getLeftOperand()), trees, assigned, parts);
            collect(new TreePath(path, binary.getRightOperand()), trees, assigned, parts);
            return;
        }
        // URI.create("...") wraps a URL without changing it; any other call is a hole.
        if (tree instanceof MethodInvocationTree call && call.getArguments().size() == 1
            && call.getMethodSelect() instanceof MemberSelectTree select
            && select.getIdentifier().contentEquals("create") && select.getExpression().toString().endsWith("URI")) {
            collect(new TreePath(path, call.getArguments().get(0)), trees, assigned, parts);
            return;
        }
        var text = literalText(path, trees);
        if (text == null && assigned != null) text = initialText(path, trees, assigned);
        parts.add(text == null ? Part.hole(configured(path, trees)) : Part.text(text));
    }

    /** A field or local that nothing assigns after its declaration holds its initializer, when that is literal text. */
    private static String initialText(TreePath path, Trees trees, Set<Element> assigned) {
        var element = trees.getElement(path);
        if (element == null || assigned.contains(element)) return null;
        if (element.getKind() != ElementKind.FIELD && element.getKind() != ElementKind.LOCAL_VARIABLE) return null;
        var declaration = trees.getPath(element);
        // An annotated field, such as one Spring injects with `@Value`, takes its value from outside the initializer.
        if (declaration == null || !(declaration.getLeaf() instanceof VariableTree variable) || variable.getInitializer() == null
            || !variable.getModifiers().getAnnotations().isEmpty()) {
            return null;
        }
        var parts = new ArrayList<Part>();
        collect(new TreePath(declaration, variable.getInitializer()), trees, null, parts);
        if (parts.stream().anyMatch(Part::hole)) return null;
        return parts.stream().map(Part::text).collect(Collectors.joining());
    }

    /** A string literal, a compile-time constant the sources declare, or a concatenation of those. */
    static String literalText(TreePath path, Trees trees) {
        if (path.getLeaf() instanceof LiteralTree literal) {
            return literal.getValue() instanceof String value ? value : null;
        }
        if (path.getLeaf() instanceof BinaryTree binary && binary.getKind() == Tree.Kind.PLUS) {
            var left = literalText(new TreePath(path, binary.getLeftOperand()), trees);
            var right = left == null ? null : literalText(new TreePath(path, binary.getRightOperand()), trees);
            return right == null ? null : left + right;
        }
        var element = trees.getElement(path);
        if (element instanceof VariableElement variable && variable.getConstantValue() instanceof String value) return value;
        return null;
    }

    /** A field the scanner cannot resolve to text is a configured value, such as an injected base URL. */
    private static boolean configured(TreePath path, Trees trees) {
        var element = trees.getElement(path);
        return element != null && (element.getKind() == ElementKind.FIELD || element.getKind() == ElementKind.ENUM_CONSTANT);
    }

    /**
     * The request fact's path and base. A literal scheme and host, a base the scanner cannot see at all, and text that
     * continues a base's last segment become a leading unknown segment; a configured value sets `configured` instead.
     */
    static void applyUrl(Map<String, Object> fact, List<Part> input) {
        var parts = new ArrayList<Part>();
        for (var part : input) if (part.hole() || !part.text().isEmpty()) parts.add(part);
        if (parts.isEmpty()) {
            fact.put("path", unknownFirst(List.of()));
            return;
        }
        var first = parts.get(0);
        var rest = parts.subList(1, parts.size());
        if (first.hole()) {
            var configured = first.configured() && startsPath(rest);
            if (configured) fact.put("configured", true);
            fact.put("path", configured ? segments(rest) : unknownFirst(segments(rest)));
            return;
        }
        // `https://host/...` and a protocol-relative `//host/...` state a host.
        if (first.text().matches("([A-Za-z][A-Za-z0-9+.\\-]*:)?//.*")) {
            var after = new ArrayList<Part>();
            after.add(Part.text(afterAuthority(first.text())));
            after.addAll(rest);
            fact.put("path", unknownFirst(segments(after)));
            return;
        }
        // Every supported client resolves a root-relative URL against its configured base; a relative one continues it.
        if (!startsPath(parts)) {
            fact.put("path", unknownFirst(segments(parts)));
            return;
        }
        fact.put("configured", true);
        fact.put("path", segments(parts));
    }

    /** Whether text after a base starts a new path segment rather than continuing the base's last one. */
    private static boolean startsPath(List<Part> parts) {
        return parts.isEmpty() || !parts.get(0).hole() && parts.get(0).text().startsWith("/");
    }

    private static List<Object> unknownFirst(List<Object> segments) {
        var result = new ArrayList<Object>();
        result.add(Json.object("kind", "unknown"));
        result.addAll(segments);
        return result;
    }

    private static String afterAuthority(String text) {
        var slash = text.indexOf('/', text.indexOf("//") + 2);
        return slash < 0 ? "" : text.substring(slash);
    }

    /** The path ends before the query and fragment, whose text never reaches the fact. */
    private static List<Object> segments(List<Part> parts) {
        // A space cannot appear in URL path text, so it marks a computed part.
        var hole = " ";
        var url = new StringBuilder();
        for (var part : parts) url.append(part.hole() ? hole : part.text());
        var text = url.toString();
        for (var mark : List.of("?", "#")) {
            var at = text.indexOf(mark);
            if (at >= 0) text = text.substring(0, at);
        }
        var segments = new ArrayList<Object>();
        for (var part : text.split("/")) {
            if (part.isEmpty()) continue;
            if (part.equals(hole)) segments.add(Json.object("kind", "dynamic"));
            else if (part.contains(hole) || !TEXT.matcher(part).matches()) segments.add(Json.object("kind", "unknown"));
            else segments.add(Json.object("kind", "literal", "value", part));
        }
        return segments;
    }
}
