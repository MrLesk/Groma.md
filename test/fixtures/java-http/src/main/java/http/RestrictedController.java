package http;

import static org.springframework.web.bind.annotation.RequestMethod.POST;

@RestController
@RequestMapping(value = "/api/restricted", method = POST)
public class RestrictedController {
    @GetMapping("/talks")
    public String talks() {
        return "talks";
    }
}
