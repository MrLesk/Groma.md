package md.groma.scanner;

import java.nio.file.Path;
import java.util.List;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.xpath.XPathFactory;
import org.w3c.dom.Document;

/**
 * Reads the declared language version, encoding and name without evaluating Maven plugins or resolving dependencies.
 * The plugin's maven.ts decides the source root and whether the project is an aggregator.
 */
final class MavenModel {
    private MavenModel() {}

    static Object read(Path file) throws Exception {
        var factory = DocumentBuilderFactory.newInstance();
        var document = factory.newDocumentBuilder().parse(file.toFile());
        String plugin = "/project/build/plugins/plugin[artifactId='maven-compiler-plugin']/configuration/";
        String release = first(document, List.of(plugin + "release", "/project/properties/maven.compiler.release", "/project/properties/java.version", "/project/properties/maven.compiler.source"));
        if (release.startsWith("1.")) release = release.substring(2);
        String encoding = first(document, List.of(plugin + "encoding", "/project/properties/project.build.sourceEncoding"));
        if (encoding.isEmpty()) encoding = "UTF-8";
        return Json.object("release", release, "encoding", encoding, "name", text(document, "/project/artifactId"));
    }

    private static String first(Document document, List<String> paths) throws Exception {
        for (String path : paths) {
            String value = text(document, path);
            if (!value.isEmpty()) return value;
        }
        return "";
    }

    private static String text(Document document, String expression) throws Exception {
        String value = XPathFactory.newInstance().newXPath().evaluate(expression, document).trim();
        for (int count = 0; count < 20 && value.startsWith("${") && value.endsWith("}"); count++) {
            String property = value.substring(2, value.length() - 1);
            value = XPathFactory.newInstance().newXPath().evaluate("/project/properties/" + property, document).trim();
        }
        return value;
    }
}
