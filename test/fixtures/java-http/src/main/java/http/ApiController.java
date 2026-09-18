package http;

@RestController
public class ApiController implements TalksApi {
    @GetMapping("/featured")
    public String featured() {
        return "featured";
    }
}
