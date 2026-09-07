package sample;
public interface Port {
    String deliver(String value);
    default String decorate(String value) { return Provider.ship(value); }
}
