using Microsoft.AspNetCore.Mvc;

namespace Shop;

[ApiController]
[Route("api/[controller]")]
public sealed class TalksController : ControllerBase
{
    private const string Archive = "archive/{year:int}";

    [HttpGet]
    public string List() => "talks";

    [HttpGet("{id:int}")]
    public string Read(int id) => $"talk {id}";

    [HttpPost]
    [HttpPut("{id?}")]
    public string Save(int? id) => "saved";

    [HttpGet(Archive)]
    public string Year(int year) => "year";

    [HttpDelete("~/admin/talks/{id}")]
    public string Remove(int id) => "removed";

    [Route("[action]")]
    public string Feed() => "feed";

    [HttpGet("v{version:int}/talks")]
    public string Versioned(int version) => "versioned";

    [HttpGet("{*slug}")]
    public string Slug(string slug) => slug;
}

[Route("api/shared")]
public abstract class SharedController : ControllerBase
{
    [HttpGet]
    public string Ping() => "pong";
}

public sealed class DerivedController : SharedController
{
    [HttpGet("{id:int}")]
    public string Read(int id) => "read";
}

[Route("[area]/notes")]
public sealed class NotesController : ControllerBase
{
    [HttpGet]
    public string List() => "notes";
}

public sealed class LegacyController : ControllerBase
{
    public string Index() => "legacy";
}
