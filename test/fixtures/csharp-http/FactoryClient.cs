using System.Net.Http;
using System.Threading.Tasks;

namespace Shop;

public sealed class FactoryClient(IHttpClientFactory factory)
{
    public Task<HttpResponseMessage> Publish()
    {
        using var message = new HttpRequestMessage(HttpMethod.Post, "/api/talks/publish");
        message.Headers.Add("X-Trace", "1");
        return factory.CreateClient("talks").SendAsync(message);
    }

    public Task<string> Drafts()
    {
        var client = factory.CreateClient();
        return client.GetStringAsync("/api/talks/drafts");
    }
}
