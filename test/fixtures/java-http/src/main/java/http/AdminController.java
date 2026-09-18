package http;

@RestController
@RequestMapping(value = {"/admin", "/staff"}, method = RequestMethod.POST)
public class AdminController {
    @RequestMapping("/talks")
    public String talks() {
        return "talks";
    }

    @GetMapping("/stats")
    public String stats() {
        return "stats";
    }
}
