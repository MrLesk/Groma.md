package http;

@RestController
public class ChildController extends BaseController {
    @GetMapping("/{id}")
    public String talk(String id) {
        return id;
    }
}
