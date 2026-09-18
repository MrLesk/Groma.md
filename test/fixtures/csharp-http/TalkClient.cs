using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;

namespace Shop;

public sealed class TalkClient(HttpClient client, LocalCache cache)
{
    private const string Talks = "api/talks";
    private static readonly string Feed = "/api/talks/feed";

    public Task<string> List() => client.GetStringAsync("/api/talks");

    public Task<HttpResponseMessage> Read(int id) => client.GetAsync($"/api/talks/{id}");

    public Task<HttpResponseMessage> Save(string body) => client.PostAsJsonAsync(Talks, body);

    public Task<HttpResponseMessage> Remove(int id) => client.DeleteAsync("/api/talks/" + id);

    public Task<HttpResponseMessage> Search(string term) => client.GetAsync($"/api/talks/find-{term}?page=1");

    public Task<HttpResponseMessage> External() => client.GetAsync("https://api.example.com/api/talks");

    public Task<HttpResponseMessage> Any(string url) => client.GetAsync(url);

    public Task<HttpResponseMessage> Ping() => client.SendAsync(new HttpRequestMessage(HttpMethod.Head, "/ping"));

    public Task<HttpResponseMessage> FeedItems() => client.GetAsync(Feed);

    public Task<string> Cached(string key) => cache.GetStringAsync(key);
}

public sealed class LocalCache
{
    public Task<string> GetStringAsync(string key) => Task.FromResult(key);
}
