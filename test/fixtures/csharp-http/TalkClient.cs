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

    public Task<HttpResponseMessage> Latest()
    {
        string url = "/api/talks/latest";
        return client.GetAsync(url);
    }

    public Task<HttpResponseMessage> Recent(bool all)
    {
        string url = "/api/talks/recent";
        if (all) url = "/api/talks";
        return client.GetAsync(url);
    }

    public Task<HttpResponseMessage> Swapped()
    {
        string url = "/api/talks/swapped";
        string other = "/api/talks";
        (url, other) = (other, url);
        return client.GetAsync(url);
    }

    public Task<HttpResponseMessage> Referenced()
    {
        string url = "/api/talks/referenced";
        Rewrite(ref url);
        return client.GetAsync(url);
    }

    public Task<HttpResponseMessage> Aliased()
    {
        string url = "/api/talks/aliased";
        ref string alias = ref url;
        alias = "/api/talks";
        return client.GetAsync(url);
    }

    private static void Rewrite(ref string url) => url = "/api/talks";
}

public sealed class ArchiveClient
{
    private readonly HttpClient client;
    private readonly string archive = "/api/talks/archive";

    public ArchiveClient(HttpClient client, string archive)
    {
        this.client = client;
        this.archive = archive;
    }

    public Task<HttpResponseMessage> Load() => client.GetAsync(archive);
}

public sealed class LocalCache
{
    public Task<string> GetStringAsync(string key) => Task.FromResult(key);
}
