package md.groma.scanner;

import com.sun.source.tree.BinaryTree;
import com.sun.source.tree.LiteralTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.TreePath;
import com.sun.source.util.Trees;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.VariableElement;

/** Path patterns and request URLs the source proves, as the shared HTTP fact format. */
final class HttpPaths {
    private static final Pattern TEXT = Pattern.compile("[A-Za-z0-9\\-._~!$&'()*+,;=:@%]+");
    private static final Pattern PARAMETER = Pattern.compile("\\{\\*?([^}:]+)(?::.*)?}");
    /** One computed expression inside a URL; a configured value is one the scanner cannot see. */
    record Part(String text, boolean hole, boolean configured) {
        static Part text(String value) { return new Part(value, false, false); }
        static Part hole(boolean configured) { return new Part("", true, configured); }
    }

    private HttpPaths() {}

    /** Literal text, `{name}`, `{name:regex}`, `{*name}`, `*` and a trailing `**`; anything else reports nothing. */
    static List<Object> endpointSegments(String pattern) {
        var segments = new ArrayList<Object>();
        var parts = pattern.split("/");
        for (int index = 0; index < parts.length; index++) {
            var part = parts[index];
            if (part.isEmpty()) continue;
            var last = index == parts.length - 1;
            var segment = endpointSegment(part, last);
            if (segment == null) return null;
            segments.add(segment);
        }
        return segments;
    }

    private static Object endpointSegment(String part, boolean last) {
        if (part.equals("**")) return last ? Json.object("kind", "catch-all", "name", "*") : null;
        if (part.equals("*")) return Json.object("kind", "parameter", "name", "*");
        var parameter = PARAMETER.matcher(part);
        if (parameter.matches()) {
            var name = parameter.group(1).trim();
            if (!TEXT.matcher(name).matches()) return null;
            return part.startsWith("{*")
                ? (last ? Json.object("kind", "catch-all", "name", name) : null)
                : Json.object("kind", "parameter", "name", name);
        }
        // A segment mixing text with a parameter, or text outside URL path characters, proves no pattern.
        return TEXT.matcher(part).matches() ? Json.object("kind", "literal", "value", part) : null;
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

    /** The parts of a URL expression: literal text, resolved constants, and holes for the rest. */
    static List<Part> urlParts(TreePath path, Trees trees) {
        var parts = new ArrayList<Part>();
        collect(path, trees, parts);
        return parts;
    }

    private static void collect(TreePath path, Trees trees, List<Part> parts) {
        var tree = path.getLeaf();
        if (tree instanceof BinaryTree binary && tree.getKind() == Tree.Kind.PLUS) {
            collect(new TreePath(path, binary.getLeftOperand()), trees, parts);
            collect(new TreePath(path, binary.getRightOperand()), trees, parts);
            return;
        }
        // URI.create("...") wraps a URL without changing it; any other call is a hole.
        if (tree instanceof MethodInvocationTree call && call.getArguments().size() == 1
            && call.getMethodSelect() instanceof MemberSelectTree select
            && select.getIdentifier().contentEquals("create") && select.getExpression().toString().endsWith("URI")) {
            collect(new TreePath(path, call.getArguments().get(0)), trees, parts);
            return;
        }
        var text = literalText(path, trees);
        // A `{name}` placeholder in a client URL is filled at runtime, as in a declarative route.
        if (text == null) parts.add(Part.hole(configured(path, trees)));
        else parts.addAll(templateParts(text));
    }

    /** A string literal or a compile-time constant the sources declare. */
    static String literalText(TreePath path, Trees trees) {
        if (path.getLeaf() instanceof LiteralTree literal) {
            return literal.getValue() instanceof String value ? value : null;
        }
        var element = trees.getElement(path);
        if (element instanceof VariableElement variable && variable.getConstantValue() instanceof String value) return value;
        return null;
    }

    /** A field the scanner cannot resolve to a constant is a configured value, such as an injected base URL. */
    private static boolean configured(TreePath path, Trees trees) {
        var element = trees.getElement(path);
        return element != null && (element.getKind() == ElementKind.FIELD || element.getKind() == ElementKind.ENUM_CONSTANT);
    }

    /**
     * The request fact's path and base. A literal scheme and host, or a base the scanner cannot see at all,
     * becomes a leading unknown segment; a configured value sets `configured` instead.
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
            if (first.configured()) fact.put("configured", true);
            fact.put("path", first.configured() ? segments(rest) : unknownFirst(segments(rest)));
            return;
        }
        if (first.text().matches("[A-Za-z][A-Za-z0-9+.\\-]*://.*")) {
            var after = new ArrayList<Part>();
            after.add(Part.text(afterAuthority(first.text())));
            after.addAll(rest);
            fact.put("path", unknownFirst(segments(after)));
            return;
        }
        // Every supported client resolves a relative or root-relative URL against its configured base.
        fact.put("configured", true);
        fact.put("path", segments(parts));
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
