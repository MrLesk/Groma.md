package md.groma.scanner;

import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.JavacTask;
import com.sun.source.util.TreeScanner;
import com.sun.source.util.Trees;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaFileObject;
import javax.tools.StandardLocation;
import javax.tools.ToolProvider;

/** Parse and attribute only. Never generate bytecode or run a repository build. */
public final class Main {
    private Main() {}

    public static void main(String[] args) {
        try {
            if (args.length == 2 && args[0].equals("model")) {
                System.out.println(Json.encode(MavenModel.read(Path.of(args[1]))));
                return;
            }
            if (args.length != 3) throw new IllegalArgumentException("Expected root, release and encoding");
            // An empty release selects the bundled compiler's own language version.
            var release = args[1].isEmpty() ? Integer.toString(Runtime.version().feature()) : args[1];
            if (Runtime.version().feature() < 21) throw new IllegalArgumentException("JDK 21 or newer is required");
            var root = Path.of(args[0]).toRealPath();
            var input = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
            var files = input.lines().filter(line -> !line.isEmpty()).map(root::resolve).toList();
            if (files.isEmpty()) throw new IllegalArgumentException("No Java files supplied");
            System.out.println(Json.encode(analyze(root, files, release, args[2])));
        } catch (Exception error) {
            System.err.println("JAVA_SCAN_FAILED: " + error.getMessage());
            System.exit(2);
        }
    }

    private static Object analyze(Path root, List<Path> files, String release, String encoding) throws Exception {
        var compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) throw new IllegalStateException("Runtime has no jdk.compiler module; a JRE is insufficient");
        var diagnostics = new DiagnosticCollector<JavaFileObject>();
        try (var manager = compiler.getStandardFileManager(diagnostics, Locale.ROOT, java.nio.charset.Charset.forName(encoding))) {
            manager.setLocationFromPaths(StandardLocation.CLASS_PATH, List.of());
            manager.setLocationFromPaths(StandardLocation.SOURCE_PATH, List.of());
            manager.setLocationFromPaths(StandardLocation.MODULE_PATH, List.of());
            var compilerOutput = new StringWriter();
            var task = (JavacTask) compiler.getTask(compilerOutput, manager, diagnostics,
                List.of("-proc:none", "-implicit:none", "--release", release, "-encoding", encoding, "-Xlint:none", "-Xmaxerrs", "1000000"),
                null, manager.getJavaFileObjectsFromPaths(files));
            task.setProcessors(List.of());
            var units = new ArrayList<CompilationUnitTree>();
            task.parse().forEach(units::add);
            var errors = diagnostics.getDiagnostics().stream()
                .filter(item -> item.getKind() == Diagnostic.Kind.ERROR).map(item -> diagnostic(root, item)).sorted().toList();
            if (!errors.isEmpty()) throw new IllegalStateException(String.join("\n", errors));
            Set<Tree> authored = Collections.newSetFromMap(new IdentityHashMap<>());
            var recorder = new TreeScanner<Void, Void>() {
                @Override public Void scan(Tree tree, Void unused) {
                    if (tree != null) authored.add(tree);
                    return super.scan(tree, unused);
                }
            };
            units.forEach(unit -> recorder.scan(unit, null));
            task.analyze();
            var index = new Declarations(root, Trees.instance(task), authored);
            units.forEach(unit -> index.scan(unit, null));
            var uses = new Uses(index, diagnostics.getDiagnostics());
            units.forEach(unit -> uses.scan(unit, null));
            var missing = new MissingTypes();
            var messages = new ArrayList<Object>();
            for (var item : diagnostics.getDiagnostics()) {
                if (!missing.add(item)) messages.add(message(root, item, "warning", item.getCode(), item.getMessage(Locale.ROOT)));
            }
            var summary = missing.diagnostic(root);
            if (summary != null) messages.add(summary);
            messages.addAll(uses.diagnostics());
            return Json.object(
                "schemaVersion", 1,
                "scanner", Json.object("id", "java", "technology", "java", "engine", "javac-tree", "engineVersion", Runtime.version().toString()),
                "roots", List.of(Json.object("id", "java:source-set", "kind", "java-project", "name", root.getFileName().toString())),
                "files", index.files(), "operations", index.operations,
                "invocations", uses.invocations, "diagnostics", messages);
        }
    }

    private static String diagnostic(Path root, Diagnostic<? extends JavaFileObject> item) {
        String location = item.getSource() == null ? "compiler" : file(root, item);
        return location + ":" + item.getLineNumber() + ": " + item.getCode() + ": " + item.getMessage(Locale.ROOT);
    }

    static Map<String, Object> message(Path root, Diagnostic<? extends JavaFileObject> item, String severity, String code, String text) {
        var message = Json.object("severity", severity, "code", code, "message", text);
        if (item.getSource() != null) message.put("file", file(root, item));
        if (item.getLineNumber() > 0) message.put("line", item.getLineNumber());
        return message;
    }

    private static String file(Path root, Diagnostic<? extends JavaFileObject> item) {
        return root.relativize(Path.of(item.getSource().toUri())).toString().replace('\\', '/');
    }
}
