package http;

@Path("/replies")
public class RepliesResource {
    @GET
    @Path("{id: \\d+}/latest")
    public String latest(String id) {
        return id;
    }
}
