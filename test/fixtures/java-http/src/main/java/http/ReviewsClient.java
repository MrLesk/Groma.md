package http;

@HttpExchange("/reviews")
public interface ReviewsClient {
    @GetExchange("/{id}")
    String review(String id);

    @GetExchange(url = "/featured")
    String featured();
}
