package sample;
sealed interface Shape permits Point {}
record Point(int x) implements Shape {
    int doubled() { return Provider.ship(x * 2); }
}
class Base {
    String render() { return Provider.ship("base"); }
}
class Child extends Base {
    String render() { return super.render(); }
}
