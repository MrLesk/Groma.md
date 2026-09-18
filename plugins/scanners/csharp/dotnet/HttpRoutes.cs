using System.Text;

namespace Groma.CSharpScanner;

/// <summary>One piece of a URL expression: text the source proves, or a value it computes, possibly from configuration.</summary>
internal readonly record struct UrlPart(string? Text, bool Configured = false)
{
    public static UrlPart Computed => new((string?)null);
    public static UrlPart Setting => new(null, Configured: true);
    public bool IsComputed => Text is null;
}

/// <summary>
/// Route templates and request URLs as contract path segments. A route constraint, or text mixed with a placeholder in
/// one segment, accepts only some values, so that segment is a constrained parameter rather than a plain one.
/// </summary>
internal static class HttpRoutes
{
    /// <summary>Endpoint segments of an ASP.NET Core route template, or null when the template is malformed.</summary>
    public static ScanHttpSegment[]? Endpoint(string template)
    {
        List<ScanHttpSegment> path = [];
        foreach (string part in TemplateParts(template))
        {
            // A catch-all takes the remaining segments, so nothing may follow it.
            if (path.Count > 0 && path[^1].Kind == "catch-all") return null;
            if (EndpointSegment(part) is not ScanHttpSegment segment) return null;
            path.Add(segment);
        }
        return [.. path];
    }

    /// <summary>Template segments, split at slashes outside placeholders, because a constraint's pattern may hold one.</summary>
    private static IEnumerable<string> TemplateParts(string template)
    {
        List<string> parts = [];
        int depth = 0;
        int start = 0;
        for (int index = 0; index < template.Length; index++)
        {
            char character = template[index];
            if (Escaped(template, index)) index++;
            else if (character == '{') depth++;
            else if (character == '}') depth--;
            else if (character == '/' && depth == 0)
            {
                parts.Add(template[start..index]);
                start = index + 1;
            }
        }
        parts.Add(template[start..]);
        return parts.Select(part => part.Trim()).Where(part => part.Length > 0);
    }

    /// <summary>A doubled brace is one literal brace, inside a placeholder or outside it.</summary>
    private static bool Escaped(string text, int index) =>
        text[index] is '{' or '}' && index + 1 < text.Length && text[index + 1] == text[index];

    /// <summary>
    /// Literal text, one placeholder, or text mixed with placeholders, which is one constrained parameter named after
    /// its first placeholder. Null when a brace is unmatched or a placeholder has no name.
    /// </summary>
    private static ScanHttpSegment? EndpointSegment(string part)
    {
        StringBuilder text = new();
        List<Placeholder> placeholders = [];
        for (int index = 0; index < part.Length; index++)
        {
            if (Escaped(part, index)) text.Append(part[index++]);
            else if (part[index] == '{')
            {
                int close = PlaceholderEnd(part, index);
                if (close < 0) return null;
                placeholders.Add(Placeholder.Of(part[(index + 1)..close]));
                index = close;
            }
            else if (part[index] == '}') return null;
            else text.Append(part[index]);
        }
        if (placeholders.Count == 0) return new ScanHttpSegment("literal", Value: Literal(text.ToString()));
        Placeholder first = placeholders[0];
        if (first.Name.Length == 0) return null;
        if (placeholders.Count > 1 || text.Length > 0) return new ScanHttpSegment("parameter", Name: Literal(first.Name), Constrained: true);
        // A catch-all in ASP.NET Core also matches no remaining segment.
        return new ScanHttpSegment(first.CatchAll ? "catch-all" : "parameter", Name: Literal(first.Name),
            Optional: first.CatchAll || first.Optional ? true : null, Constrained: first.Constrained ? true : null);
    }

    /// <summary>The brace that closes the placeholder opened at start, or -1 when none does.</summary>
    private static int PlaceholderEnd(string part, int start)
    {
        for (int index = start + 1; index < part.Length; index++)
        {
            if (Escaped(part, index)) index++;
            else if (part[index] == '}') return index;
            else if (part[index] == '{') return -1;
        }
        return -1;
    }

    /// <summary>
    /// A placeholder such as <c>{*path}</c>, <c>{id:int?}</c> or <c>{page=1}</c>: a leading <c>*</c> marks a catch-all,
    /// <c>:</c> starts its constraints, and a default value or a final <c>?</c> makes it optional. A constraint's
    /// arguments sit in parentheses and may contain those characters.
    /// </summary>
    private readonly record struct Placeholder(string Name, bool CatchAll, bool Optional, bool Constrained)
    {
        public static Placeholder Of(string text)
        {
            bool catchAll = text.StartsWith('*');
            text = text.TrimStart('*');
            int defaultValue = OutsideParentheses(text, '=');
            string declared = defaultValue >= 0 ? text[..defaultValue] : text.TrimEnd('?');
            bool optional = defaultValue >= 0 || declared.Length < text.Length;
            int constraints = OutsideParentheses(declared, ':');
            return new Placeholder((constraints >= 0 ? declared[..constraints] : declared).Trim(), catchAll, optional, constraints >= 0);
        }

        private static int OutsideParentheses(string text, char wanted)
        {
            int depth = 0;
            for (int index = 0; index < text.Length; index++)
            {
                if (text[index] == '(') depth++;
                else if (text[index] == ')') depth--;
                else if (text[index] == wanted && depth == 0) return index;
            }
            return -1;
        }
    }

    /// <summary>An action template under its controller prefix. A template starting with ~/ or / replaces the prefix.</summary>
    public static string Join(string prefix, string template)
    {
        if (template.StartsWith("~/", StringComparison.Ordinal)) return template[1..];
        return template.StartsWith('/') ? template : Under(prefix, template);
    }

    /// <summary>A pattern under a route group's prefix, which a leading slash never escapes.</summary>
    public static string Under(string prefix, string template) => $"{prefix.TrimEnd('/')}/{template.TrimStart('/')}";

    /// <summary>A declarative client template's {parameter} holes are values the call computes.</summary>
    public static List<UrlPart> Template(string template)
    {
        List<UrlPart> parts = [];
        int index = 0;
        while (index < template.Length)
        {
            int open = template.IndexOf('{', index);
            if (open < 0)
            {
                parts.Add(new UrlPart(template[index..]));
                break;
            }
            if (open > index) parts.Add(new UrlPart(template[index..open]));
            parts.Add(UrlPart.Computed);
            int close = template.IndexOf('}', open);
            if (close < 0) break;
            index = close + 1;
        }
        return parts;
    }

    /// <summary>
    /// Request segments of a URL expression. The path follows a configured base when its text is relative; a host,
    /// or a base the scanner cannot resolve, becomes a leading unknown segment, which core never matches.
    /// </summary>
    public static (bool Configured, ScanHttpSegment[] Path) Request(IReadOnlyList<UrlPart> parts)
    {
        List<ScanHttpSegment> path = [];
        string? first = parts.Count > 0 ? parts[0].Text : null;
        if (parts.Count == 0)
        {
            path.Add(new ScanHttpSegment("unknown"));
            return (false, [.. path]);
        }
        if (first is null)
        {
            // A configuration value followed by a path is a configured base; text continuing its last segment is not.
            if (parts[0].Configured && parts.Count > 1 && parts[1].Text is string rest && rest.StartsWith('/'))
            {
                Segments(parts.Skip(1), path, unresolvedBase: false);
                return (true, [.. path]);
            }
            // Any other computed start may hold a host, so whatever it produces stays unknown.
            Segments(parts, path, unresolvedBase: true);
            return (false, [.. path]);
        }
        int authority = Authority(first);
        if (authority >= 0)
        {
            path.Add(new ScanHttpSegment("unknown"));
            Segments(parts.Skip(1).Prepend(new UrlPart(first[authority..])), path, unresolvedBase: false);
            return (false, [.. path]);
        }
        Segments(parts, path, unresolvedBase: false);
        return (!first.StartsWith('/'), [.. path]);
    }

    /// <summary>Index of the path that follows a scheme or authority, or -1 when the text has none.</summary>
    private static int Authority(string text)
    {
        int start = text.StartsWith("//", StringComparison.Ordinal) ? 2
            : text.IndexOf("://", StringComparison.Ordinal) is int scheme && scheme >= 0 ? scheme + 3 : -1;
        if (start < 0) return -1;
        int slash = text.IndexOf('/', start);
        return slash < 0 ? text.Length : slash;
    }

    /// <summary>A segment is literal when all its text is proven, dynamic when it is wholly computed, unknown when mixed.</summary>
    private static void Segments(IEnumerable<UrlPart> parts, List<ScanHttpSegment> path, bool unresolvedBase)
    {
        StringBuilder text = new();
        bool computed = false;
        bool firstSegment = true;
        void Close()
        {
            string kind = computed ? text.Length > 0 || (firstSegment && unresolvedBase) ? "unknown" : "dynamic" : "literal";
            if (computed) path.Add(new ScanHttpSegment(kind));
            else if (text.Length > 0) path.Add(new ScanHttpSegment(kind, Value: Literal(text.ToString())));
            if (computed || text.Length > 0) firstSegment = false;
            text.Clear();
            computed = false;
        }
        foreach (UrlPart part in parts)
        {
            if (part.IsComputed) { computed = true; continue; }
            foreach (char character in part.Text!)
            {
                if (character is '?' or '#') { Close(); return; }
                if (character == '/') Close();
                else text.Append(character);
            }
        }
        Close();
    }

    /// <summary>Percent-encodes what RFC 3986 path text excludes, so core can compare literals exactly.</summary>
    private static string Literal(string value) => string.Concat(value.Select(character =>
        char.IsAsciiLetterOrDigit(character) || "-._~!$&'()*+,;=:@%".Contains(character)
            ? character.ToString()
            : Uri.EscapeDataString(character.ToString())));
}
