package md.groma.scanner;

import java.nio.file.Path;
import java.util.List;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.xpath.XPathFactory;
import org.w3c.dom.Document;

/** Reads Maven's effective model, never an unevaluated project POM. */
final class MavenModel {
    private MavenModel() {}

    static Object read(Path file) throws Exception {
        var factory = DocumentBuilderFactory.newInstance();
        var document = factory.newDocumentBuilder().parse(file.toFile());
        if (!text(document, "count(/project/modules/module)").equals("0")) {
            throw new IllegalArgumentException("Only a single Maven module is supported; reactor builds are not supported");
        }
        String plugin = "/project/build/plugins/plugin[artifactId='maven-compiler-plugin']/configuration/";
        String release = first(document, List.of(plugin + "release", "/project/properties/maven.compiler.release"));
        if (release.isEmpty()) throw new IllegalArgumentException("Declare maven.compiler.release in the Maven project");
        String encoding = first(document, List.of(plugin + "encoding", "/project/properties/project.build.sourceEncoding"));
        if (encoding.isEmpty()) encoding = "UTF-8";
        String generated = text(document, plugin + "generatedSourcesDirectory");
        if (generated.isEmpty()) generated = text(document, "/project/build/directory") + "/generated-sources/annotations";
        return Json.object("release", release, "encoding", encoding,
            "sourceRoot", text(document, "/project/build/sourceDirectory"), "generatedRoot", generated,
            "output", text(document, "/project/build/outputDirectory"),
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
        return XPathFactory.newInstance().newXPath().evaluate(expression, document).trim();
    }
}
