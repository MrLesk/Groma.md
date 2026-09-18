package http;

@RestController
@RequestMapping("/api/stream")
public class StreamController {
    @GetMapping("/talks")
    public Flux<String> talks() {
        return Flux.just("talk");
    }
}
