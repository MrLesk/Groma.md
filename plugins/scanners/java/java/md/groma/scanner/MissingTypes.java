package md.groma.scanner;

import java.nio.file.Path;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import javax.tools.Diagnostic;
import javax.tools.JavaFileObject;

/**
 * Summarizes javac's "cannot find symbol" and "package does not exist" errors as one info diagnostic.
 * The scanner leaves project dependencies and generated sources out on purpose, so these errors are an
 * expected limitation, not a project defect. javac cannot tell a missing dependency from any other
 * unresolved name, so every unresolved name is counted, including typos.
 */
final class MissingTypes {
    // Main requests Locale.ROOT, whose text for compiler.err.doesnt.exist is "package {0} does not exist".
    private static final Pattern PACKAGE = Pattern.compile("package (\\S+) does not exist");
    private final Map<String, Integer> packages = new HashMap<>();
    private int count;
    private Diagnostic<? extends JavaFileObject> example;

    /** Absorbs an unresolved-name error and returns true; returns false for any other diagnostic. */
    boolean add(Diagnostic<? extends JavaFileObject> item) {
        var code = item.getCode();
        var missingPackage = code.equals("compiler.err.doesnt.exist");
        if (!missingPackage && !code.startsWith("compiler.err.cant.resolve")) return false;
        if (example == null) example = item;
        count++;
        if (missingPackage) {
            var name = PACKAGE.matcher(item.getMessage(Locale.ROOT));
            if (name.matches()) packages.merge(name.group(1), 1, Integer::sum);
        }
        return true;
    }

    /** The JAVA_MISSING_EXTERNAL_TYPES diagnostic, or null when nothing was absorbed. */
    Map<String, Object> diagnostic(Path root) {
        if (example == null) return null;
        var frequent = packages.entrySet().stream()
            .sorted(Map.Entry.<String, Integer>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
            .limit(5).map(Map.Entry::getKey).collect(Collectors.joining(", "));
        var text = count + " symbol and package references are unresolved (project dependencies and generated sources are not loaded).";
        if (!frequent.isEmpty()) text += " Most frequently missing packages: " + frequent + ".";
        return Main.message(root, example, "info", "JAVA_MISSING_EXTERNAL_TYPES", text);
    }
}
