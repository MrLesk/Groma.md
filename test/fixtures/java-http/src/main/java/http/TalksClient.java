package http;

@FeignClient(name = "talks", path = "/api")
public interface TalksClient {
    @GetMapping("/talks/{id}")
    String talk(String id);

    @DeleteMapping("/talks/{id}")
    void remove(String id);
}
