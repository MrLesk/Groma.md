package http;

@RestController
@RequestMapping("/hotels/*")
public class HotelsController {
    @GetMapping("/booking")
    public String booking() {
        return "booking";
    }
}
