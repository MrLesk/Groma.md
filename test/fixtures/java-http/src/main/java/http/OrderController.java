package http;

@RestController
public class OrderController extends BaseController implements TalksApi {
    @GetMapping("/order")
    public String order() {
        return "order";
    }
}
