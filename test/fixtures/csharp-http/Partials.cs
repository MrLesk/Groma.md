using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

namespace Shop;

[Route("api/partials")]
public sealed partial class PartialsController : ControllerBase
{
}

public sealed partial class PartialClient(HttpClient client)
{
    private readonly string target = "/api/talks/partial";

    public Task<HttpResponseMessage> Load() => client.GetAsync(target);
}
