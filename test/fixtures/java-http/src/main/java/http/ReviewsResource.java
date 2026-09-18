package http;

@Path("/reviews")
public class ReviewsResource {
    @GET
    public String all() {
        return "all";
    }

    @GET
    @Path("{id}")
    public String one(String id) {
        return id;
    }

    @POST
    @Path("{id}")
    public String add(String id) {
        return id;
    }

    @Path("{id}/comments")
    public Object comments(String id) {
        return id;
    }
}
