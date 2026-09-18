package md.groma.scanner;

import com.sun.source.tree.AnnotationTree;
import com.sun.source.tree.AssignmentTree;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.IdentifierTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.ModifiersTree;
import com.sun.source.tree.NewArrayTree;
import com.sun.source.tree.NewClassTree;
import com.sun.source.tree.ParameterizedTypeTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreePath;
import com.sun.source.util.TreePathScanner;
import com.sun.source.util.TreeScanner;
import com.sun.source.util.Trees;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.BiConsumer;

/**
 * HTTP endpoints this application serves and requests it sends. Endpoints come from controller and
 * resource classes; an interface never serves, so a declarative client reports requests instead.
 */
final class Http extends TreePathScanner<Void, Void> {
    private static final Map<String, String> MAPPINGS = Map.ofEntries(
        Map.entry("GetMapping", "GET"), Map.entry("PostMapping", "POST"), Map.entry("PutMapping", "PUT"),
        Map.entry("DeleteMapping", "DELETE"), Map.entry("PatchMapping", "PATCH"), Map.entry("RequestMapping", "*"),
        Map.entry("GetExchange", "GET"), Map.entry("PostExchange", "POST"), Map.entry("PutExchange", "PUT"),
        Map.entry("DeleteExchange", "DELETE"), Map.entry("PatchExchange", "PATCH"), Map.entry("HttpExchange", "*"));
    private static final Set<String> JAXRS_METHODS = Set.of("GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS");
    private static final Map<String, String> REST_TEMPLATE = Map.ofEntries(
        Map.entry("getForObject", "GET"), Map.entry("getForEntity", "GET"), Map.entry("postForObject", "POST"),
        Map.entry("postForEntity", "POST"), Map.entry("postForLocation", "POST"), Map.entry("put", "PUT"),
        Map.entry("delete", "DELETE"), Map.entry("patchForObject", "PATCH"), Map.entry("headForHeaders", "HEAD"),
        Map.entry("optionsForAllow", "OPTIONS"));
    /** A RestTemplate call that names its method in an HttpMethod argument. */
    private static final Set<String> REST_TEMPLATE_METHOD_ARGUMENT = Set.of("exchange", "execute");
    private static final Set<String> FLUENT_CLIENTS = Set.of("RestClient", "WebClient");
    private static final Set<String> BUILDER_METHODS = Set.of("GET", "POST", "PUT", "DELETE", "HEAD");

    final List<Object> endpoints = new ArrayList<>();
    final List<Object> requests = new ArrayList<>();
    private final Declarations index;
    private final Trees trees;
    /** Declared type of each variable and field in the current file; a name with two types is dropped. */
    private final Map<String, String> types = new HashMap<>();
    private final Set<String> shadowed = new HashSet<>();

    Http(Declarations index, Trees trees) {
        this.index = index;
        this.trees = trees;
    }

    @Override public Void visitCompilationUnit(CompilationUnitTree tree, Void unused) {
        types.clear();
        shadowed.clear();
        new TreeScanner<Void, Void>() {
            @Override public Void visitVariable(VariableTree variable, Void ignored) {
                var name = variable.getName().toString();
                var type = typeName(variable.getType());
                var previous = type == null ? null : types.put(name, type);
                if (previous != null && !previous.equals(type)) shadowed.add(name);
                return super.visitVariable(variable, ignored);
            }
        }.scan(tree, null);
        return super.visitCompilationUnit(tree, unused);
    }

    @Override public Void visitClass(ClassTree tree, Void unused) {
        var path = getCurrentPath();
        if (tree.getKind() == Tree.Kind.CLASS) endpointsOf(path, tree);
        else clientRequestsOf(path, tree);
        return super.visitClass(tree, unused);
    }

    /** Spring MVC and WebFlux controllers and JAX-RS resource classes serve the paths they declare. */
    private void endpointsOf(TreePath path, ClassTree tree) {
        var spring = annotation(tree.getModifiers(), "RestController") != null
            || annotation(tree.getModifiers(), "Controller") != null;
        var jaxrs = annotation(tree.getModifiers(), "Path") != null;
        if (!spring && !jaxrs) return;
        var declared = annotation(tree.getModifiers(), spring ? "RequestMapping" : "Path");
        // A base class can hold the prefix, and reporting the paths without it would claim shorter routes.
        if (declared == null && tree.getExtendsClause() != null) return;
        var prefix = declared == null ? "" : first(routes(path, declared));
        if (prefix == null) return;
        for (var member : tree.getMembers()) {
            if (!(member instanceof MethodTree method)) continue;
            var operation = index.operationAt.get(method);
            if (operation == null) continue;
            var methodPath = new TreePath(path, method);
            if (spring) mapped(methodPath, method, prefix, (verb, route) -> endpoint(operation, verb, route));
            if (jaxrs) jaxrs(methodPath, method, prefix, operation);
        }
    }

    /** A JAX-RS resource method names its methods with annotations and its own path with `@Path`. */
    private void jaxrs(TreePath methodPath, MethodTree method, String prefix, String operation) {
        var route = prefix;
        var own = annotation(method.getModifiers(), "Path");
        if (own != null) {
            var text = first(routes(methodPath, own));
            if (text == null) return;
            route = route + "/" + text;
        }
        for (var verb : JAXRS_METHODS) {
            if (annotation(method.getModifiers(), verb) != null) endpoint(operation, verb, route);
        }
    }

    /** Feign and Spring HTTP interfaces declare requests with the same annotations a controller uses. */
    private void clientRequestsOf(TreePath path, ClassTree tree) {
        var feign = annotation(tree.getModifiers(), "FeignClient");
        var exchange = annotation(tree.getModifiers(), "HttpExchange");
        if (feign == null && exchange == null) return;
        var prefix = feign == null ? first(routes(path, exchange)) : text(path, feign, "path");
        var host = feign == null ? "" : text(path, feign, "url");
        if (prefix == null || host == null) return;
        for (var member : tree.getMembers()) {
            if (!(member instanceof MethodTree method)) continue;
            var methodPath = new TreePath(path, method);
            mapped(methodPath, method, prefix, (verb, route) -> {
                var parts = new ArrayList<HttpPaths.Part>();
                // Without a literal URL the client resolves its base from configuration.
                parts.add(host.isEmpty() ? HttpPaths.Part.hole(true) : HttpPaths.Part.text(host));
                parts.addAll(HttpPaths.templateParts(route));
                request(index.declareOperation(methodPath), verb, parts);
            });
        }
    }

    /** Every Spring mapping and HTTP exchange annotation on the method, with each literal route it declares. */
    private void mapped(TreePath methodPath, MethodTree method, String prefix, BiConsumer<String, String> report) {
        for (var annotation : method.getModifiers().getAnnotations()) {
            var verb = MAPPINGS.get(typeName(annotation.getAnnotationType()));
            if (verb == null) continue;
            var routes = routes(methodPath, annotation);
            if (routes == null) continue;
            if (routes.isEmpty()) routes = List.of("");
            for (var declared : verbs(methodPath, annotation, verb)) {
                for (var route : routes) report.accept(declared, prefix + "/" + route);
            }
        }
    }

    /** `@RequestMapping(method = RequestMethod.PUT)` and `@HttpExchange(method = "PUT")` name their methods. */
    private List<String> verbs(TreePath methodPath, AnnotationTree annotation, String verb) {
        if (!verb.equals("*")) return List.of(verb);
        var stated = argument(annotation, "method");
        // Without a method attribute the mapping serves every method; an unresolved one proves nothing.
        if (stated == null) return List.of("*");
        var declared = new ArrayList<String>();
        for (var value : values(stated)) {
            var text = value instanceof MemberSelectTree select ? select.getIdentifier().toString()
                : HttpPaths.literalText(new TreePath(methodPath, value), trees);
            if (text != null && text.matches("[A-Z]+")) declared.add(text);
        }
        return declared.size() == values(stated).size() ? declared : List.of();
    }

    @Override public Void visitMethodInvocation(MethodInvocationTree tree, Void unused) {
        if (tree.getMethodSelect() instanceof MemberSelectTree select) {
            var name = select.getIdentifier().toString();
            if (name.equals("newBuilder") && "HttpRequest".equals(typeName(select.getExpression()))) builder(tree);
            else if ("RestTemplate".equals(receiverType(select.getExpression()))) restTemplate(tree, name);
            else if (name.equals("uri")) fluent(tree, select.getExpression());
        }
        return super.visitMethodInvocation(tree, unused);
    }

    /** RestTemplate names its method in the call, or in an `HttpMethod` argument for exchange and execute. */
    private void restTemplate(MethodInvocationTree tree, String name) {
        if (tree.getArguments().isEmpty()) return;
        var verb = REST_TEMPLATE.get(name);
        if (verb == null && REST_TEMPLATE_METHOD_ARGUMENT.contains(name) && tree.getArguments().size() > 1) {
            verb = memberName(tree.getArguments().get(1));
        }
        if (verb == null) return;
        request(operation(), verb, HttpPaths.urlParts(new TreePath(getCurrentPath(), tree.getArguments().get(0)), trees));
    }

    /** RestClient and WebClient name the method in the call before `uri`. */
    private void fluent(MethodInvocationTree tree, ExpressionTree receiver) {
        if (!(receiver instanceof MethodInvocationTree call) || tree.getArguments().isEmpty()) return;
        if (!(call.getMethodSelect() instanceof MemberSelectTree select)) return;
        var type = receiverType(select.getExpression());
        if (type == null || !FLUENT_CLIENTS.contains(type)) return;
        var name = select.getIdentifier().toString();
        var verb = name.equals("method") && !call.getArguments().isEmpty()
            ? memberName(call.getArguments().get(0)) : name.toUpperCase(Locale.ROOT);
        if (verb == null || !verb.matches("[A-Z]+")) return;
        request(operation(), verb, HttpPaths.urlParts(new TreePath(getCurrentPath(), tree.getArguments().get(0)), trees));
    }

    /** `HttpRequest.newBuilder()` takes its URI and method from the builder chain and defaults to GET. */
    private void builder(MethodInvocationTree newBuilder) {
        var parts = new ArrayList<HttpPaths.Part>();
        var path = getCurrentPath();
        if (!newBuilder.getArguments().isEmpty()) {
            parts.addAll(HttpPaths.urlParts(new TreePath(path, newBuilder.getArguments().get(0)), trees));
        }
        String verb = null;
        var stated = false;
        for (var call = chained(path); call != null; call = chained(path = call)) {
            var invocation = (MethodInvocationTree) call.getLeaf();
            var name = ((MemberSelectTree) invocation.getMethodSelect()).getIdentifier().toString();
            if (name.equals("uri") && !invocation.getArguments().isEmpty()) {
                parts.clear();
                parts.addAll(HttpPaths.urlParts(new TreePath(call, invocation.getArguments().get(0)), trees));
            } else if (BUILDER_METHODS.contains(name)) verb = name;
            else if (name.equals("method")) {
                stated = true;
                verb = invocation.getArguments().isEmpty() ? null
                    : HttpPaths.literalText(new TreePath(call, invocation.getArguments().get(0)), trees);
            }
        }
        // A chain naming no method sends GET; one whose method the scanner cannot read proves nothing.
        if (parts.isEmpty() || stated && (verb == null || !verb.matches("[A-Z]+"))) return;
        request(operation(), verb == null ? "GET" : verb, parts);
    }

    /** The invocation that calls a method on this expression's result, such as `.uri(...)` after it. */
    private static TreePath chained(TreePath path) {
        var parent = path.getParentPath();
        if (parent == null || !(parent.getLeaf() instanceof MemberSelectTree select) || select.getExpression() != path.getLeaf()) {
            return null;
        }
        var call = parent.getParentPath();
        return call != null && call.getLeaf() instanceof MethodInvocationTree ? call : null;
    }

    private void endpoint(String operation, String verb, String route) {
        var segments = HttpPaths.endpointSegments(route);
        if (segments != null) endpoints.add(Json.object("operation", operation, "method", verb, "path", segments));
    }

    private void request(String operation, String verb, List<HttpPaths.Part> parts) {
        if (operation == null) return;
        var fact = Json.object("operation", operation);
        if (!verb.equals("*")) fact.put("method", verb);
        HttpPaths.applyUrl(fact, parts);
        requests.add(fact);
    }

    /** The operation whose body supplies the URL. */
    private String operation() {
        for (var path = getCurrentPath(); path != null; path = path.getParentPath()) {
            var id = index.operationAt.get(path.getLeaf());
            if (id != null) return id;
        }
        return null;
    }

    private static AnnotationTree annotation(ModifiersTree modifiers, String name) {
        for (var annotation : modifiers.getAnnotations()) {
            if (name.equals(typeName(annotation.getAnnotationType()))) return annotation;
        }
        return null;
    }

    /**
     * Every literal route an annotation states in a path attribute: empty when it states none, null when
     * the sources do not prove the text. `url` is the alias an HTTP exchange annotation may use.
     */
    private List<String> routes(TreePath path, AnnotationTree annotation) {
        var stated = argument(annotation, "value", "path", "url");
        if (stated == null) return List.of();
        var routes = new ArrayList<String>();
        for (var element : values(stated)) {
            var route = HttpPaths.literalText(new TreePath(path, element), trees);
            if (route == null) return null;
            routes.add(route);
        }
        return routes;
    }

    /** The literal text of one named attribute: empty when absent, null when unresolved. */
    private String text(TreePath path, AnnotationTree annotation, String name) {
        var stated = argument(annotation, name);
        return stated == null ? "" : HttpPaths.literalText(new TreePath(path, stated), trees);
    }

    private static String first(List<String> routes) {
        return routes == null ? null : routes.isEmpty() ? "" : routes.get(0);
    }

    /** The expression an annotation gives one of these attributes, taking `value` from a bare argument. */
    private static ExpressionTree argument(AnnotationTree annotation, String... names) {
        for (var name : names) {
            for (var argument : annotation.getArguments()) {
                if (argument instanceof AssignmentTree assignment) {
                    if (assignment.getVariable().toString().equals(name)) return assignment.getExpression();
                } else if (name.equals("value")) return argument;
            }
        }
        return null;
    }

    private static List<? extends ExpressionTree> values(ExpressionTree value) {
        if (value == null) return List.of();
        return value instanceof NewArrayTree array ? array.getInitializers() : List.of(value);
    }

    private static String memberName(ExpressionTree value) {
        return value instanceof MemberSelectTree select ? select.getIdentifier().toString() : null;
    }

    /** The declared type of the receiver, resolved by name inside this file. */
    private String receiverType(ExpressionTree receiver) {
        var name = receiver instanceof MemberSelectTree select && select.getExpression().toString().equals("this")
            ? select.getIdentifier().toString() : typeName(receiver);
        if (name == null || shadowed.contains(name)) return null;
        return types.getOrDefault(name, name);
    }

    /** The simple name a type or receiver expression spells. */
    private static String typeName(Tree tree) {
        if (tree instanceof MemberSelectTree select) return select.getIdentifier().toString();
        if (tree instanceof ParameterizedTypeTree parameterized) return typeName(parameterized.getType());
        if (tree instanceof IdentifierTree identifier) return identifier.getName().toString();
        if (tree instanceof NewClassTree created) return typeName(created.getIdentifier());
        return null;
    }
}
