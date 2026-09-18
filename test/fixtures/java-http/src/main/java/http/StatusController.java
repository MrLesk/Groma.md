package http;

@RestController
public class StatusController implements ErrorController, java.io.Serializable {
    @Override
    public String getErrorPath() {
        return "/error";
    }

    @GetMapping("/status")
    public String status() {
        return "ok";
    }
}
