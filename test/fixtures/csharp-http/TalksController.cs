using System.Threading.Tasks;
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

    [HttpGet("drafts")]
    [HttpPost("publish")]
    public string Publish() => "published";

    [HttpGet]
    [Route("latest")]
    public string Latest() => "latest";

    [HttpGet("tags/{tag:regex(^a=?$)}/raw{{copy}}")]
    public string Tag(string tag) => tag;

    [AcceptVerbs("GET")]
    [Route("verbs")]
    public string Verbs() => "verbs";

    [NonAction]
    [HttpGet("hidden")]
    public string Hidden() => "hidden";

    [HttpGet("secret")]
    private string Secret() => "secret";

    [HttpGet("shared")]
    public static string Shared() => "shared";

    [HttpGet("generic")]
    public string Generic<T>() => "generic";

    [HttpGet(template: "named")]
    public string Named() => "named";
}

[Route("api/async")]
public sealed class AsyncController : ControllerBase
{
    [HttpGet("[action]")]
    public Task<string> LatestAsync() => Task.FromResult("latest");

    [HttpGet("[action]")]
    [ActionName("Newest")]
    public string Recent() => "newest";
}

[Route("~/api/rooted")]
public sealed class RootedController : ControllerBase
{
    [HttpGet]
    public string List() => "rooted";
}

public abstract class ArchiveBase : ControllerBase
{
    [HttpGet("latest")]
    public string Latest() => "latest";
}

[Route("api/derived")]
public sealed class DerivedArchiveController : ArchiveBase
{
    [HttpGet("{slug}")]
    public string Read(string slug) => slug;
}

[NonController]
public abstract class HiddenBase : ControllerBase
{
}

[Route("api/external")]
public sealed class ExternalController : ExternalBase
{
    [HttpGet]
    public string List() => "external";
}

[Route("api/[controller]")]
public sealed class Lowercasecontroller : ControllerBase
{
    [HttpGet]
    public string List() => "lowercase";
}

[Route("api/routes")]
public sealed class RoutesController : ControllerBase
{
    [HttpGet(Name = "read")]
    [Route("r")]
    public string Read() => "read";
}

[Route("api/hidden")]
public sealed class HiddenArchiveController : HiddenBase
{
    [HttpGet]
    public string List() => "hidden";
}

[Route("api/internal")]
internal sealed class InternalController : ControllerBase
{
    [HttpGet]
    public string List() => "internal";
}

[Route("api/things")]
public sealed class Things
{
    [HttpGet]
    public string List() => "things";
}

[Route("api/shared")]
public abstract class SharedController : ControllerBase
{
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
