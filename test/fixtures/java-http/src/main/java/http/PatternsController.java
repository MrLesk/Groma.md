package http;

@RestController
@RequestMapping("/patterns")
public class PatternsController {
    static final String NAME = "[a-z]+";

    @GetMapping("/{id:\\d+}")
    public String numbered(String id) {
        return id;
    }

    @GetMapping("/{name:" + NAME + "}/profile")
    public String profile(String name) {
        return name;
    }

    @GetMapping("/tree/{*path}")
    public String tree(String path) {
        return path;
    }

    @GetMapping("/${patterns.segment}/items")
    public String configured() {
        return "configured";
    }

    @GetMapping("/exports/*.json")
    public String exports() {
        return "exports";
    }
}
