package entry;
import static sample.Provider.ship;
import sample.Provider;
import sample.Port;
import sample.Unused;
public class Caller {
    static String initial = ship("initial");
    static { ship("block"); }
    public static String wrap(String value) { return ship(value); }
    public static void run(Port port) {
        wrap("wrapper");
        ship(42);
        port.deliver("virtual");
        port.decorate("default");
        new Provider().deliver("exact");
        Runnable later = () -> ship("lambda");
        java.util.function.Function<String, String> reference = Provider::ship;
        later.run();
        reference.apply("deferred");
    }
}
