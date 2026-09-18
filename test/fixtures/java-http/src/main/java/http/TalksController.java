package http;

@RestController
@RequestMapping(TalksController.BASE)
public class TalksController {
    static final String BASE = "/api";

    @GetMapping("/talks/{id}")
    public String talk(String id) {
        return id;
    }

    @PostMapping("/talks")
    public String create() {
        return "created";
    }

    @RequestMapping(path = "/talks", method = RequestMethod.PUT)
    public String replace() {
        return "replaced";
    }

    @GetMapping("/files/**")
    public String files() {
        return "files";
    }

    @GetMapping("/v{version}/talks")
    public String versioned() {
        return "versioned";
    }
}
