package http;

public class Shadowed {
    public String talk(String id) {
        RestTemplate client = new RestTemplate();
        return client.getForObject("/api/talks/{id}", String.class, id);
    }

    public void forget() {
        TalkRepository client = new TalkRepository();
        client.delete("/api/talks");
    }
}
