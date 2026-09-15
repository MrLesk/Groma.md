package md.groma.scanner;

import java.nio.file.Path;
import java.util.List;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.xpath.XPathFactory;
import org.w3c.dom.Document;

/** Reads declared source settings without evaluating Maven plugins or resolving dependencies. */
final class MavenModel {
    private MavenModel() {}

    static Object read(Path file) throws Exception {
        var factory = DocumentBuilderFactory.newInstance();
        var document = factory.newDocumentBuilder().parse(file.toFile());
        if (text(document, "/project/packaging").equals("pom")) {
            return Json.object("aggregator", true);
        }
        String plugin = "/project/build/plugins/plugin[artifactId='maven-compiler-plugin']/configuration/";
        String release = first(document, List.of(plugin + "release", "/project/properties/maven.compiler.release", "/project/properties/java.version", "/project/properties/maven.compiler.source"));
        if (release.isEmpty()) release = Integer.toString(Runtime.version().feature());
        if (release.startsWith("1.")) release = release.substring(2);
        String encoding = first(document, List.of(plugin + "encoding", "/project/properties/project.build.sourceEncoding"));
        if (encoding.isEmpty()) encoding = "UTF-8";
        String source = text(document, "/project/build/sourceDirectory");
        if (source.isEmpty()) source = "src/main/java";
        source = source.replace("${project.basedir}", file.getParent().toString()).replace("${basedir}", file.getParent().toString());
        return Json.object("release", release, "encoding", encoding, "sourceRoot", source,
            "name", text(document, "/project/artifactId"));
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
