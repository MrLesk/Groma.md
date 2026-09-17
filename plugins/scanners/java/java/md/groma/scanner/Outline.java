package md.groma.scanner;

import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.Tree;
import com.sun.source.util.JavacTask;
import com.sun.source.util.SourcePositions;
import com.sun.source.util.Trees;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import javax.lang.model.element.Modifier;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaFileObject;
import javax.tools.ToolProvider;

/** Top-level types with their methods and constructors, from a parse without a classpath or attribution. */
final class Outline {
    private final CompilationUnitTree unit;
    private final SourcePositions positions;
    private final String source;

    private Outline(CompilationUnitTree unit, SourcePositions positions) throws Exception {
        this.unit = unit;
        this.positions = positions;
        this.source = unit.getSourceFile().getCharContent(true).toString();
    }

    static List<Object> read(Path root, List<Path> files) throws Exception {
        var compiler = ToolProvider.getSystemJavaCompiler();
        // Syntax errors do not stop the outline; the parser keeps the declarations it recognized.
        var ignored = new DiagnosticCollector<JavaFileObject>();
        try (var manager = compiler.getStandardFileManager(ignored, Locale.ROOT, StandardCharsets.UTF_8)) {
            var task = (JavacTask) compiler.getTask(new StringWriter(), manager, ignored, List.of("-proc:none"), null,
                manager.getJavaFileObjectsFromPaths(files));
            var positions = Trees.instance(task).getSourcePositions();
            var result = new ArrayList<Object>();
            for (var unit : task.parse()) {
                var file = root.relativize(Path.of(unit.getSourceFile().toUri())).toString().replace('\\', '/');
                result.add(Json.object("file", file, "declarations", new Outline(unit, positions).types()));
            }
            return result;
        }
    }

    /** Package declarations are transparent; nested types stay inside their declaring type. */
    private List<Object> types() {
        return unit.getTypeDecls().stream().filter(ClassTree.class::isInstance).map(tree -> type((ClassTree) tree)).toList();
    }

    private Object type(ClassTree tree) {
        var name = tree.getSimpleName().toString();
        var members = tree.getMembers().stream().filter(MethodTree.class::isInstance)
            .map(member -> member(tree, (MethodTree) member)).toList();
        return Json.object("kind", "type", "name", name, "line", lineOf(namePosition(name, tree, List.of(tree.getModifiers()))),
            "visibility", typeVisibility(tree), "members", members);
    }

    private Object member(ClassTree type, MethodTree method) {
        var constructor = method.getName().contentEquals("<init>");
        var name = constructor ? type.getSimpleName().toString() : method.getName().toString();
        var before = new ArrayList<Tree>(method.getTypeParameters());
        before.add(method.getModifiers());
        if (method.getReturnType() != null) before.add(method.getReturnType());
        var position = namePosition(name, method, before);
        // A record's compact constructor is followed by its body, not by a parameter list.
        var compact = constructor && next(position + name.length()) == '{';
        return Json.object("name", name, "line", lineOf(position), "visibility", visibility(type, method, compact));
    }

    private static String typeVisibility(ClassTree type) {
        // A top-level type is public or, without a modifier, visible to its package.
        return type.getModifiers().getFlags().contains(Modifier.PUBLIC) ? "public" : "internal";
    }

    private static String visibility(ClassTree type, MethodTree method, boolean compact) {
        var flags = method.getModifiers().getFlags();
        if (flags.contains(Modifier.PUBLIC)) return "public";
        if (flags.contains(Modifier.PROTECTED)) return "protected";
        if (flags.contains(Modifier.PRIVATE)) return "private";
        var kind = type.getKind();
        if (kind == Tree.Kind.INTERFACE || kind == Tree.Kind.ANNOTATION_TYPE) return "public";
        // Without a modifier a compact constructor has the record's access, and an enum constructor is private.
        if (compact) return typeVisibility(type);
        return kind == Tree.Kind.ENUM && method.getName().contentEquals("<init>") ? "private" : "internal";
    }

    /** The name's first occurrence after the modifiers, type parameters and return type. */
    private long namePosition(String name, Tree declaration, List<? extends Tree> before) {
        long from = positions.getStartPosition(unit, declaration);
        for (var tree : before) from = Math.max(from, positions.getEndPosition(unit, tree));
        var matcher = Pattern.compile("(?<!\\p{javaJavaIdentifierPart})" + Pattern.quote(name) + "(?!\\p{javaJavaIdentifierPart})")
            .matcher(source);
        return matcher.find((int) from) ? matcher.start() : from;
    }

    private long lineOf(long position) {
        return unit.getLineMap().getLineNumber(position);
    }

    private char next(long position) {
        for (int index = (int) position; index < source.length(); index++) {
            if (!Character.isWhitespace(source.charAt(index))) return source.charAt(index);
        }
        return 0;
    }
}
