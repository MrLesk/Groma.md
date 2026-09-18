using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;

namespace Shop;

public sealed class SettingsClient(HttpClient client, IConfiguration configuration)
{
    private readonly Dictionary<string, string> settings = new();

    public Task<HttpResponseMessage> Indexed() => client.GetAsync(configuration["Api:Base"] + "/api/settings");

    public Task<HttpResponseMessage> Typed() => client.GetAsync($"{configuration.GetValue<string>("Api:Base")}/api/settings/typed");

    public Task<HttpResponseMessage> Section() => client.GetAsync(configuration.GetSection("Api").Value + "/api/settings/section");

    public Task<HttpResponseMessage> Connection() => client.GetAsync(configuration.GetConnectionString("Api") + "/api/settings/connection");

    public Task<HttpResponseMessage> Variable() => client.GetAsync(Environment.GetEnvironmentVariable("API_BASE") + "/api/settings/variable");

    public Task<HttpResponseMessage> Glued() => client.GetAsync(configuration["Api:Base"] + "settings");

    public Task<HttpResponseMessage> Lookalike() => client.GetAsync(settings["Api:Base"] + "/api/settings");

    public Task<HttpResponseMessage> LookalikeVariable() =>
        client.GetAsync(Settings.Environment.GetEnvironmentVariable("API_BASE") + "/api/settings/lookalike");
}

public static class Settings
{
    public static class Environment
    {
        public static string GetEnvironmentVariable(string name) => name;
    }
}
