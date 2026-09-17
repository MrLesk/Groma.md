namespace Shop.Orders;

public delegate void OrderPlaced(int id);

public partial class OrderService
{
    private readonly int limit;

    public OrderService(int limit) => this.limit = limit;

    static OrderService() { }

    ~OrderService() { }

    public event OrderPlaced? Placed;

    public int Count { get; private set; }

    public int Place(int quantity) => quantity;

    public int Place(string sku) => sku.Length;

    protected internal void Retry() { }

    private protected void Reset() { }

    internal void Audit() { }

    void Trace() { }

    public static OrderService operator +(OrderService left, OrderService right) => left;

    public static implicit operator int(OrderService service) => service.limit;

    private sealed class Line
    {
        public void Nested() { }
    }
}

struct Money
{
    public decimal Amount() => 0;
}

public interface IOrders
{
    int Place(int quantity);

    protected void Hook() { }
}

public record Receipt(int Id)
{
    public string Print() => Id.ToString();
}

public enum Status { Open, Closed }

file class Scratch
{
    public void Use() { }
}
