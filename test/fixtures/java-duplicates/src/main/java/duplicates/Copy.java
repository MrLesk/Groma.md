package duplicates;

import java.util.List;

public class Copy {
    public boolean readyToRun(List<String> stages, int threshold) {
        int finished = 0;
        for (String stage : stages) {
            if (stage.isEmpty()) {
                continue;
            }
            finished = finished + 1;
            if (finished >= threshold) {
                return true;
            }
        }
        return false;
    }

    public int completion(List<String> stages, int count) {
        StringBuilder log = new StringBuilder();
        int position = 0;
        while (position < stages.size()) {
            log.append(stages.get(position));
            log.append(";");
            position = position + 1;
        }
        if (count == 0) {
            return log.length();
        }
        return log.length() * 1000 / count;
    }

    public int fact(int number) {
        if (number <= 1) {
            return 1;
        }
        return number * fact(number - 1);
    }

    public String head(String[] data, int size) {
        return data[0];
    }

    public int othered() {
        int other = 5;
        return other + other();
    }

    public int other() {
        return 1;
    }
}
