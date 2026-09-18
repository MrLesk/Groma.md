package http;

@RestController
public class LibraryController implements LibraryApi {
    @GetMapping("/library")
    public String library() {
        return "library";
    }
}
