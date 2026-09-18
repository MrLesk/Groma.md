package http;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class Clients {
    private static final String TALKS = "/api/talks";

    private final RestTemplate restTemplate = new RestTemplate();
    private final RestClient restClient = RestClient.create();
    private final WebClient webClient = WebClient.create();
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final String base;
    private String outside = "https://outside.example";
    @Value("${reviews.url}")
    private String injected = "https://outside.example";
    private String retargeted = "https://outside.example";

    public Clients(String base) {
        this.base = base;
    }

    public String talk(String id) {
        return restTemplate.getForObject(TALKS + "/" + id, String.class);
    }

    public void replace() {
        restTemplate.put(TALKS, "body");
    }

    public String exchanged() {
        return restTemplate.exchange(TALKS, HttpMethod.POST, null, String.class).getBody();
    }

    public String exchangedUnknown() {
        return restTemplate.exchange(TALKS, Verbs.POST, null, String.class).getBody();
    }

    public String fluentUnknown() {
        return restClient.method(Verbs.POST).uri("/api/talks").retrieve().body(String.class);
    }

    public String reviews() {
        return restClient.get().uri("/reviews").retrieve().body(String.class);
    }

    public String review(String id) {
        return restClient.get().uri("/reviews/{id}", id).retrieve().body(String.class);
    }

    public String template(String id) {
        return restTemplate.getForObject(TALKS + "/{id}", String.class, id);
    }

    public String anyMethod(String verb) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(TALKS))
            .method(verb, HttpRequest.BodyPublishers.noBody())
            .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString()).body();
    }

    public String stream() {
        return webClient.get().uri("/api/stream/talks").retrieve().body(String.class);
    }

    public HttpResponse<String> host() throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.example.com/api/talks")).GET().build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    public String configured() throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(base + "/api/talks"))
            .method("PATCH", HttpRequest.BodyPublishers.noBody())
            .build();
        return httpClient.send(request, HttpResponse.BodyHandlers.ofString()).body();
    }

    public String computed(String suffix) {
        return restTemplate.getForObject(buildUrl(suffix), String.class);
    }

    private String buildUrl(String suffix) {
        return TALKS + "/" + suffix + "/details";
    }

    public String partly(String term) {
        return restTemplate.getForObject(TALKS + "/find-" + term, String.class);
    }

    public String adminTalks() {
        return restTemplate.getForObject("/admin/talks", String.class);
    }

    public String numbered() {
        return restTemplate.getForObject("/patterns/42", String.class);
    }

    public String latestReply() {
        return restTemplate.getForObject("/replies/7/latest", String.class);
    }

    public String protocolRelative() {
        return restTemplate.getForObject("//outside.example/api/stream/talks", String.class);
    }

    public String glued() {
        return restTemplate.getForObject(base + "reviews", String.class);
    }

    public String relative() {
        return restTemplate.getForObject("reviews", String.class);
    }

    public String outsideField() {
        return restTemplate.getForObject(outside + "/reviews", String.class);
    }

    public void retarget(String url) {
        retargeted = url;
    }

    public String injectedBase() {
        return restTemplate.getForObject(injected + "/reviews", String.class);
    }

    public String retargetedBase() {
        return restTemplate.getForObject(retargeted + "/reviews", String.class);
    }

    public String localPath() {
        String reviews = "/reviews";
        return restTemplate.getForObject(reviews, String.class);
    }
}
