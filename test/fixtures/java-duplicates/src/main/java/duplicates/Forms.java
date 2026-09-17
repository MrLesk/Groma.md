package duplicates;

import java.util.List;
import java.util.function.Supplier;

public class Forms {
    static final List<String> DEFAULTS = List.of("one");

    static {
        DEFAULTS.size();
    }

    private final Supplier<String> first = () -> DEFAULTS.get(0);

    {
        first.get();
    }

    public void apply() {
    }

    public Runnable hook() {
        return new Runnable() {
            @Override
            public void run() {
                DEFAULTS.size();
            }
        };
    }

    public String local(String text) {
        class Trimmer {
            String trim(String value) {
                return value.trim();
            }
        }
        return new Trimmer().trim(text);
    }
}
