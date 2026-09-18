package http;

import static org.springframework.web.bind.annotation.RequestMethod.GET;

@RestController
@RequestMapping("/api/imported")
public class ImportedMethodController {
    @RequestMapping(value = "/talks", method = GET)
    public String talks() {
        return "talks";
    }

    @RequestMapping(value = "/audit", method = Verbs.METHOD)
    public String audit() {
        return "audit";
    }
}
