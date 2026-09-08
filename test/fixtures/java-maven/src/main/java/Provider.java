package sample;
public final class Provider implements Port {
    public Provider() {}
    public static String ship(String value) { return value; }
    public static int ship(int value) { return value; }
    public String deliver(String value) { return ship(value); }
}
