package http;

@RestController
@RequestMapping(ExternalRoutes.BASE)
public class PrefixController {
    @GetMapping("/talks")
    public String talks() {
        return "talks";
    }
}
