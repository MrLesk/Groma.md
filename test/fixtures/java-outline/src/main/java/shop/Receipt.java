package shop;

public record Receipt(String id, long total) {
    Receipt {
    }

    Receipt(String id) {
        this(id, 0);
    }

    public String label() {
        return id;
    }
}
