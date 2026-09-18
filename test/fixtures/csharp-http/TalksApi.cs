using System.Threading.Tasks;
using Refit;

namespace Shop;

public interface ITalksApi
{
    [Get("/api/talks")]
    Task<string> List();

    [Get("/api/talks/{id}")]
    Task<string> Read(int id);

    [Post("/api/talks")]
    Task Create(string body);
}
