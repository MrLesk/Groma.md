package shop;

import java.util.List;

/** Takes orders. */
@Deprecated
public class Orders {
    private final List<String> lines = List.of();

    static {
        System.out.println("loaded");
    }

    public Orders() {
    }

    Orders(String first) {
    }

    public List<String>
        place(String line) {
        return lines;
    }

    public List<String> place(String line, int count) {
        return lines;
    }

    protected static <T> T first(List<T> items) {
        return items.get(0);
    }

    private void audit() {
        Runnable nested = new Runnable() {
            public void run() {
            }
        };
    }

    int count() {
        return lines.size();
    }

    static class Line {
        void describe() {
        }
    }
}

interface Pricing {
    long price(String sku);

    default long discounted(String sku) {
        return price(sku);
    }

    private long base() {
        return 0;
    }

    static Pricing none() {
        return sku -> 0;
    }
}

enum Status {
    OPEN {
        void describe() {
        }
    },
    CLOSED;

    Status() {
    }

    public boolean open() {
        return this == OPEN;
    }
}

@interface Audited {
    String value() default "";
}

abstract class Base {
    abstract void apply();
}
