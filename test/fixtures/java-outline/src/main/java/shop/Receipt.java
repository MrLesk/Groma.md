package shop;

public record Receipt(String id, long total) {
    Receipt /* compact */ {
    }

    Receipt(String id) {
        this(id, 0);
    }

    public String label() {
        return id;
    }

    public <T>
    @Deprecated
    Receipt(T source, int copies) {
        this(String.valueOf(source), copies);
    }
}
