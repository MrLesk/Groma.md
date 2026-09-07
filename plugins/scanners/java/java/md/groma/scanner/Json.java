package md.groma.scanner;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Output-only JSON: the worker accepts a bounded file list, not executable configuration. */
final class Json {
    private Json() {}

    static Map<String, Object> object(Object... pairs) {
        var result = new LinkedHashMap<String, Object>();
        for (int i = 0; i < pairs.length; i += 2) result.put((String) pairs[i], pairs[i + 1]);
        return result;
    }

    static String encode(Object value) {
        if (value == null) return "null";
        if (value instanceof String text) return quote(text);
        if (value instanceof Number || value instanceof Boolean) return value.toString();
        if (value instanceof List<?> list) {
            return list.stream().map(Json::encode).collect(Collectors.joining(",", "[", "]"));
        }
        if (value instanceof Map<?, ?> map) {
            return map.entrySet().stream()
                .map(entry -> quote((String) entry.getKey()) + ":" + encode(entry.getValue()))
                .collect(Collectors.joining(",", "{", "}"));
        }
        throw new IllegalArgumentException("Unsupported JSON value: " + value.getClass());
    }

    private static String quote(String text) {
        var output = new StringBuilder("\"");
        for (char c : text.toCharArray()) {
            if (c == '\\' || c == '"') output.append('\\').append(c);
            else if (c < 32) output.append(String.format("\\u%04x", (int) c));
            else output.append(c);
        }
        return output.append('"').toString();
    }
}
