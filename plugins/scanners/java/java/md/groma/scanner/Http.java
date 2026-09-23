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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.regex.Pattern;
import javax.lang.model.element.Element;
import javax.lang.model.type.TypeKind;

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
    private static final Pattern WILDCARD = Pattern.compile("[*?]");
    /** Supertypes known to declare no request mapping, which the scanner cannot resolve without the classpath. */
    private static final Set<String> UNMAPPED_SUPERTYPES = Set.of("ErrorController");

    final List<Object> endpoints = new ArrayList<>();
    final List<Object> requests = new ArrayList<>();
    private final Declarations index;
    private final Trees trees;
    /** Declared type of each variable and field in the current file; a name with two types is dropped. */
    private final Map<String, String> types = new HashMap<>();
    private final Set<String> shadowed = new HashSet<>();
    /** Every variable some statement assigns after its declaration, in any file. */
    private final Set<Element> assigned;

    Http(Declarations index, Trees trees, Set<Element> assigned) {
        this.index = index;
        this.trees = trees;
        this.assigned = assigned;
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
        var modifiers = tree.getModifiers();
        if (annotation(modifiers, "RestController") != null || annotation(modifiers, "Controller") != null) springEndpoints(path, tree);
        // JAX-RS reads the class's own path.
        var jaxrs = annotation(modifiers, "Path");
        if (jaxrs == null) return;
        var prefix = routes(path, jaxrs).get(0);
        for (var member : tree.getMembers()) {
            var operation = index.operationAt.get(member);
            if (member instanceof MethodTree method && operation != null) jaxrs(new TreePath(path, method), method, prefix, operation);
        }
    }

    /**
     * A Spring controller's mappings under each class-level route, which Spring finds on the class or its supertypes.
     * A route the scanner sees but cannot read becomes a blocker from its unreadable part on, and so does an
     * un-annotated override whose mapping a supertype the scanner cannot resolve may declare.
     */
    private void springEndpoints(TreePath path, ClassTree tree) {
        var mapping = typeMapping(path, new HashSet<>());
        var declared = mapping.annotation() != null;
        var prefixes = declared ? routes(mapping.type(), mapping.annotation()).stream().map(Http::springPrefix).toList() : List.of("");
        // Spring adds a class-level `method` to every mapping of the class.
        var classVerbs = declared ? verbs(mapping.type(), mapping.annotation(), "*") : List.of("*");
        var unresolved = unresolvedSupertype(path, new HashSet<>());
        for (var member : tree.getMembers()) {
            var operation = index.operationAt.get(member);
            if (!(member instanceof MethodTree method) || operation == null) continue;
            var methodPath = new TreePath(path, method);
            var inheritsMapping = unresolved && annotation(method.getModifiers(), "Override") != null && !declaresMapping(method);
            for (var prefix : prefixes) {
                if (inheritsMapping) endpoint(operation, "*", prefix + "/" + HttpPaths.UNREADABLE, false);
                reportMappings(methodPath, method, prefix, classVerbs, (verb, route) -> endpoint(operation, verb, route, false));
            }
        }
    }

    /** The type that declares a class-level mapping, with that annotation, or null when the hierarchy declares none. */
    private record TypeMapping(TreePath type, AnnotationTree annotation) {}

    /**
     * The class-level mapping Spring finds: the class's own, else the first one on its interfaces and then its
     * superclass, searched through their own supertypes in the sources. A supertype outside the sources is taken to
     * declare none.
     */
    private TypeMapping typeMapping(TreePath type, Set<Tree> searched) {
        var tree = (ClassTree) type.getLeaf();
        var own = annotation(tree.getModifiers(), "RequestMapping");
        if (own != null || !searched.add(tree)) return new TypeMapping(type, own);
        for (var supertype : supertypes(tree)) {
            var declaration = sourceDeclaration(new TreePath(type, supertype));
            if (declaration == null) continue;
            var found = typeMapping(declaration, searched);
            if (found.annotation() != null) return found;
        }
        return new TypeMapping(type, null);
    }

    /** The declaration a supertype clause names when it is in the sources, else null. */
    private TreePath sourceDeclaration(TreePath clause) {
        var element = trees.getElement(clause);
        var declaration = element == null ? null : trees.getPath(element);
        return declaration != null && declaration.getLeaf() instanceof ClassTree ? declaration : null;
    }

    private static List<Tree> supertypes(ClassTree tree) {
        var supertypes = new ArrayList<Tree>(tree.getImplementsClause());
        if (tree.getExtendsClause() != null) supertypes.add(tree.getExtendsClause());
        return supertypes;
    }

    /**
     * Whether the type or a supertype of it in the sources extends or implements a type that does not resolve, other
     * than one known to declare no mapping, such as Spring's `ErrorController`.
     */
    private boolean unresolvedSupertype(TreePath type, Set<Tree> searched) {
        var tree = (ClassTree) type.getLeaf();
        if (!searched.add(tree)) return false;
        for (var supertype : supertypes(tree)) {
            var clause = new TreePath(type, supertype);
            var mirror = trees.getTypeMirror(clause);
            if (mirror != null && mirror.getKind() == TypeKind.ERROR) {
                if (!UNMAPPED_SUPERTYPES.contains(typeName(supertype))) return true;
                continue;
            }
            var declaration = sourceDeclaration(clause);
            if (declaration != null && unresolvedSupertype(declaration, searched)) return true;
        }
        return false;
    }

    private static boolean declaresMapping(MethodTree method) {
        return method.getModifiers().getAnnotations().stream().anyMatch(annotation -> MAPPINGS.containsKey(typeName(annotation.getAnnotationType())));
    }

    /** Spring joins a prefix holding a wildcard with a route by its own rules, so the route is unreadable from there. */
    private static String springPrefix(String route) {
        var wildcard = WILDCARD.matcher(route);
        return wildcard.find() ? route.substring(0, route.lastIndexOf('/', wildcard.start()) + 1) + HttpPaths.UNREADABLE : route;
    }

    /**
     * A JAX-RS resource method names its methods with annotations and its own path with `@Path`. A sub-resource
     * locator, a `@Path` method without an HTTP method, hands every request under its path to another object.
     */
    private void jaxrs(TreePath methodPath, MethodTree method, String prefix, String operation) {
        var own = annotation(method.getModifiers(), "Path");
        var route = prefix + "/" + (own == null ? "" : routes(methodPath, own).get(0));
        var verbs = JAXRS_METHODS.stream().filter(verb -> annotation(method.getModifiers(), verb) != null).toList();
        if (verbs.isEmpty() && own != null) endpoint(operation, "*", route + "/" + HttpPaths.UNREADABLE, true);
        for (var verb : verbs) endpoint(operation, verb, route, true);
    }

    /** Feign and Spring HTTP interfaces declare requests with the same annotations a controller uses. */
    private void clientRequestsOf(TreePath path, ClassTree tree) {
        if (annotation(tree.getModifiers(), "RegisterRestClient") != null) {
            microprofileRequestsOf(path, tree);
            return;
        }
        var feign = annotation(tree.getModifiers(), "FeignClient");
        var exchange = annotation(tree.getModifiers(), "HttpExchange");
        if (feign == null && exchange == null) return;
        var prefix = feign == null ? routes(path, exchange).get(0) : text(path, feign, "path");
        var host = feign == null ? "" : text(path, feign, "url");
        if (prefix == null || host == null) return;
        for (var member : tree.getMembers()) {
            if (!(member instanceof MethodTree method)) continue;
            var methodPath = new TreePath(path, method);
            reportMappings(methodPath, method, prefix, List.of("*"), (verb, route) -> {
                if (route.contains(HttpPaths.UNREADABLE)) return;
                var parts = new ArrayList<HttpPaths.Part>();
                // Without a literal URL the client resolves its base from configuration.
                parts.add(host.isEmpty() ? HttpPaths.Part.hole(true) : HttpPaths.Part.text(host));
                parts.addAll(HttpPaths.templateParts(route));
                request(index.declareOperation(methodPath), verb, parts);
            });
        }
    }

    /** A MicroProfile REST client declares JAX-RS methods under its interface path. */
    private void microprofileRequestsOf(TreePath path, ClassTree tree) {
        var root = annotation(tree.getModifiers(), "Path");
        var prefix = root == null ? "" : routes(path, root).get(0);
        for (var member : tree.getMembers()) {
            if (!(member instanceof MethodTree method)) continue;
            var methodPath = new TreePath(path, method);
            var own = annotation(method.getModifiers(), "Path");
            var route = prefix + "/" + (own == null ? "" : routes(methodPath, own).get(0));
            if (route.contains(HttpPaths.UNREADABLE)) continue;
            for (var verb : JAXRS_METHODS) {
                if (annotation(method.getModifiers(), verb) == null) continue;
                var parts = new ArrayList<HttpPaths.Part>();
                parts.add(HttpPaths.Part.hole(true));
                parts.addAll(HttpPaths.templateParts(route));
                request(index.declareOperation(methodPath), verb, parts);
            }
        }
    }

    /**
     * Every Spring mapping and HTTP exchange annotation on the method, with each route it declares and the methods it
     * serves together with the class-level ones. A route or method the scanner cannot read makes the route unreadable
     * from there, and unknown methods report every method.
     */
    private void reportMappings(TreePath methodPath, MethodTree method, String prefix, List<String> classVerbs,
        BiConsumer<String, String> report) {
        for (var annotation : method.getModifiers().getAnnotations()) {
            var verb = MAPPINGS.get(typeName(annotation.getAnnotationType()));
            if (verb == null) continue;
            var routes = routes(methodPath, annotation);
            var verbs = combined(classVerbs, verbs(methodPath, annotation, verb));
            var unknown = verbs.isEmpty() ? "/" + HttpPaths.UNREADABLE : "";
            for (var declared : verbs.isEmpty() ? List.of("*") : verbs) {
                for (var route : routes) report.accept(declared, prefix + "/" + route + unknown);
            }
        }
    }

    /** `@RequestMapping(method = RequestMethod.PUT)` and `@HttpExchange(method = "PUT")` name their methods. */
    private List<String> verbs(TreePath path, AnnotationTree annotation, String verb) {
        if (!verb.equals("*")) return List.of(verb);
        var stated = argument(annotation, "method");
        // Without a method attribute the mapping serves every method; an unresolved one proves nothing.
        if (stated == null) return List.of("*");
        var declared = new ArrayList<String>();
        for (var value : values(stated)) {
            var text = value instanceof MemberSelectTree ? constant(value, "RequestMethod")
                : HttpPaths.literalText(new TreePath(path, value), trees);
            if (isVerb(text)) declared.add(text);
        }
        return declared.size() == values(stated).size() ? declared : List.of();
    }

    /**
     * Spring serves the union of class-level and method-level methods; a side without a method adds no restriction,
     * and an unresolved side leaves the methods unknown.
     */
    private static List<String> combined(List<String> classVerbs, List<String> own) {
        if (classVerbs.isEmpty() || own.isEmpty()) return List.of();
        if (classVerbs.contains("*")) return own;
        if (own.contains("*")) return classVerbs;
        var union = new LinkedHashSet<>(classVerbs);
        union.addAll(own);
        return List.copyOf(union);
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
            verb = constant(tree.getArguments().get(1), "HttpMethod");
        }
        if (verb == null) return;
        request(operation(), verb, HttpPaths.urlParts(new TreePath(getCurrentPath(), tree.getArguments().get(0)), trees, assigned));
    }

    /** RestClient and WebClient name the method in the call before `uri`. */
    private void fluent(MethodInvocationTree tree, ExpressionTree receiver) {
        if (!(receiver instanceof MethodInvocationTree call) || tree.getArguments().isEmpty()) return;
        if (!(call.getMethodSelect() instanceof MemberSelectTree select)) return;
        var source = select.getExpression();
        var type = source instanceof MethodInvocationTree build && build.getArguments().isEmpty()
            && build.getMethodSelect() instanceof MemberSelectTree method && method.getIdentifier().contentEquals("build")
            && "WebClient.Builder".equals(receiverType(method.getExpression()))
            ? "WebClient" : receiverType(source);
        if (type == null || !FLUENT_CLIENTS.contains(type)) return;
        var name = select.getIdentifier().toString();
        var verb = name.equals("method") && !call.getArguments().isEmpty()
            ? constant(call.getArguments().get(0), "HttpMethod") : name.toUpperCase(Locale.ROOT);
        if (!isVerb(verb)) return;
        request(operation(), verb, HttpPaths.urlParts(new TreePath(getCurrentPath(), tree.getArguments().get(0)), trees, assigned));
    }

    /** `HttpRequest.newBuilder()` takes its URI and method from the builder chain and defaults to GET. */
    private void builder(MethodInvocationTree newBuilder) {
        var parts = new ArrayList<HttpPaths.Part>();
        var path = getCurrentPath();
        if (!newBuilder.getArguments().isEmpty()) {
            parts.addAll(HttpPaths.urlParts(new TreePath(path, newBuilder.getArguments().get(0)), trees, assigned));
        }
        String verb = null;
        var stated = false;
        for (var call = chained(path); call != null; call = chained(path = call)) {
            var invocation = (MethodInvocationTree) call.getLeaf();
            var name = ((MemberSelectTree) invocation.getMethodSelect()).getIdentifier().toString();
            if (name.equals("uri") && !invocation.getArguments().isEmpty()) {
                parts.clear();
                parts.addAll(HttpPaths.urlParts(new TreePath(call, invocation.getArguments().get(0)), trees, assigned));
            } else if (BUILDER_METHODS.contains(name)) verb = name;
            else if (name.equals("method")) {
                stated = true;
                verb = invocation.getArguments().isEmpty() ? null
                    : HttpPaths.literalText(new TreePath(call, invocation.getArguments().get(0)), trees);
            }
        }
        // A chain naming no method sends GET; one whose method the scanner cannot read proves nothing.
        if (parts.isEmpty() || stated && !isVerb(verb)) return;
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

    private void endpoint(String operation, String verb, String route, boolean jaxrs) {
        endpoints.add(Json.object("operation", operation, "method", verb, "path", HttpPaths.endpointSegments(route, jaxrs)));
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
     * Every literal route an annotation states in a path attribute: `""` when it states none, and `UNREADABLE` when the
     * sources do not prove the text. `url` is the alias an HTTP exchange annotation may use.
     */
    private List<String> routes(TreePath path, AnnotationTree annotation) {
        var routes = new ArrayList<String>();
        for (var element : values(argument(annotation, "value", "path", "url"))) {
            var route = HttpPaths.literalText(new TreePath(path, element), trees);
            if (route == null) return List.of(HttpPaths.UNREADABLE);
            routes.add(route);
        }
        return routes.isEmpty() ? List.of("") : routes;
    }

    /** The literal text of one named attribute: empty when absent, null when unresolved. */
    private String text(TreePath path, AnnotationTree annotation, String name) {
        var stated = argument(annotation, name);
        return stated == null ? "" : HttpPaths.literalText(new TreePath(path, stated), trees);
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

    private static boolean isVerb(String text) {
        return text != null && text.matches("[A-Z]+");
    }

    /** A constant of the named type, such as `HttpMethod.POST`; null for anything else. */
    private static String constant(ExpressionTree value, String type) {
        return value instanceof MemberSelectTree select && type.equals(typeName(select.getExpression()))
            ? select.getIdentifier().toString() : null;
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
        if (tree instanceof MemberSelectTree select && select.getIdentifier().contentEquals("Builder")
            && "WebClient".equals(typeName(select.getExpression()))) return "WebClient.Builder";
        if (tree instanceof MemberSelectTree select) return select.getIdentifier().toString();
        if (tree instanceof ParameterizedTypeTree parameterized) return typeName(parameterized.getType());
        if (tree instanceof IdentifierTree identifier) return identifier.getName().toString();
        if (tree instanceof NewClassTree created) return typeName(created.getIdentifier());
        return null;
    }
}
