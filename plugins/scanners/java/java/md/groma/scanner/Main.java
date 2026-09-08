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
import java.util.Set;
import java.util.regex.Pattern;
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
            if (args.length != 4) throw new IllegalArgumentException("Expected root, release, encoding and generated source root");
            if (Runtime.version().feature() < 21) throw new IllegalArgumentException("JDK 21 or newer is required");
            var root = Path.of(args[0]).toRealPath();
            var input = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
            var classpath = input.readLine();
            if (classpath == null) throw new IllegalArgumentException("Missing classpath input");
            var files = input.lines().filter(line -> !line.isEmpty()).map(root::resolve).toList();
            if (files.isEmpty()) throw new IllegalArgumentException("No Java files supplied");
            System.out.println(Json.encode(analyze(root, files, args[1], classpath, args[2], args[3])));
        } catch (Exception error) {
            System.err.println("JAVA_SCAN_FAILED: " + error.getMessage());
            System.exit(2);
        }
    }

    private static Object analyze(Path root, List<Path> files, String release, String classpath, String encoding, String generated) throws Exception {
        var compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) throw new IllegalStateException("Runtime has no jdk.compiler module; a JRE is insufficient");
        var diagnostics = new DiagnosticCollector<JavaFileObject>();
        try (var manager = compiler.getStandardFileManager(diagnostics, Locale.ROOT, java.nio.charset.Charset.forName(encoding))) {
            var dependencies = classpath.isEmpty() ? List.<Path>of()
                : Pattern.compile(Pattern.quote(java.io.File.pathSeparator)).splitAsStream(classpath).map(Path::of).toList();
            manager.setLocationFromPaths(StandardLocation.CLASS_PATH, dependencies);
            manager.setLocationFromPaths(StandardLocation.SOURCE_PATH, generated.isEmpty() ? List.of() : List.of(Path.of(generated)));
            manager.setLocationFromPaths(StandardLocation.MODULE_PATH, List.of());
            var compilerOutput = new StringWriter();
            var task = (JavacTask) compiler.getTask(compilerOutput, manager, diagnostics,
                List.of("-proc:none", "-implicit:none", "--release", release, "-encoding", encoding, "-Xlint:none"),
                null, manager.getJavaFileObjectsFromPaths(files));
            task.setProcessors(List.of());
            var units = new ArrayList<CompilationUnitTree>();
            task.parse().forEach(units::add);
            Set<Tree> authored = Collections.newSetFromMap(new IdentityHashMap<>());
            var recorder = new TreeScanner<Void, Void>() {
                @Override public Void scan(Tree tree, Void unused) {
                    if (tree != null) authored.add(tree);
                    return super.scan(tree, unused);
                }
            };
            units.forEach(unit -> recorder.scan(unit, null));
            task.analyze();
            var errors = diagnostics.getDiagnostics().stream()
                .filter(item -> item.getKind() == Diagnostic.Kind.ERROR).map(item -> diagnostic(root, item)).sorted().toList();
            if (!errors.isEmpty()) throw new IllegalStateException(String.join("\n", errors));
            var index = new Declarations(root, Trees.instance(task), authored);
            units.forEach(unit -> index.scan(unit, null));
            var uses = new Uses(index);
            units.forEach(unit -> uses.scan(unit, null));
            var messages = new ArrayList<Object>();
            for (var item : diagnostics.getDiagnostics()) {
                messages.add(Json.object("severity", "warning", "code", item.getCode(), "message", diagnostic(root, item)));
            }
            messages.addAll(uses.diagnostics());
            return Json.object(
                "schemaVersion", 1, "complete", true,
                "scanner", Json.object("language", "java", "engine", "javac-tree", "engineVersion", Runtime.version().toString()),
                "root", Json.object("kind", "maven-project", "name", root.getFileName().toString(), "file", "pom.xml"),
                "scopes", List.of(Json.object("id", "java:source-set", "name", root.getFileName().toString())),
                "files", index.files(), "placements", index.placements(),
                "relationships", uses.relationships(), "operations", index.operations,
                "invocations", uses.invocations, "diagnostics", messages);
        }
    }

    private static String diagnostic(Path root, Diagnostic<? extends JavaFileObject> item) {
        String location = item.getSource() == null ? "compiler" : root.relativize(Path.of(item.getSource().toUri())).toString().replace('\\', '/');
        return location + ":" + item.getLineNumber() + ": " + item.getCode() + ": " + item.getMessage(Locale.ROOT);
    }
}
