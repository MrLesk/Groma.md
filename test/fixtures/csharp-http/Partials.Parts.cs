using System.Net.Http;
using Microsoft.AspNetCore.Mvc;

namespace Shop;

public sealed partial class PartialsController
{
    [HttpGet("{id}")]
    public string Read(int id) => "read";
}

public sealed partial class PartialClient
{
    public PartialClient(HttpClient client, string target) : this(client) => this.target = target;
}
