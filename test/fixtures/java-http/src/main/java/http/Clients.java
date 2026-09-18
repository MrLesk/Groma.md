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
}
