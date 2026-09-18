package http;

@RestController
@RequestMapping("/featured")
public class FeaturedController implements GeneratedFeaturedApi {
    @Override
    public String featured() {
        return "featured";
    }

    public String helper() {
        return "helper";
    }
}
