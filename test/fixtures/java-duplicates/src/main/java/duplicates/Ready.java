package duplicates;

import java.util.List;

public class Ready {
    public boolean canStart(List<String> steps, int limit) {
        int done = 0;
        for (String step : steps) {
            if (step.isEmpty()) {
                continue;
            }
            done = done + 1;
            if (done >= limit) {
                return true;
            }
        }
        return false;
    }

    public int progress(List<String> steps, int total) {
        StringBuilder trace = new StringBuilder();
        int index = 0;
        while (index < steps.size()) {
            trace.append(steps.get(index));
            trace.append(",");
            index = index + 1;
        }
        if (total == 0) {
            return trace.length();
        }
        return trace.length() * 100 / total;
    }

    public int factorial(int value) {
        if (value <= 1) {
            return 1;
        }
        return value * factorial(value - 1);
    }

    public String tail(String[] data, int size) {
        return data[size - 1];
    }

    public int helped() {
        int helper = 5;
        return helper + helper();
    }

    public int helper() {
        return 1;
    }
}
