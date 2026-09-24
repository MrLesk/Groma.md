using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace Groma.CSharpScanner;

/// <summary>An item a project file declares, such as a Compile, Using or ProjectReference, with its expanded metadata.</summary>
internal sealed record ProjectItem(string Type, string? Include, string? Remove, string? Exclude, IReadOnlyDictionary<string, string> Metadata)
{
    public string? Value(string name) => Metadata.TryGetValue(name, out string? value) ? value : null;
}

/// <summary>
/// The part of MSBuild evaluation that source analysis needs, read from XML without running MSBuild: the SDKs a
/// project names, and the unconditional properties and items of its nearest Directory.Build.props, the project file
/// and the files they import, in document order. Conditions, targets, SDK files and property functions are not
/// evaluated.
/// </summary>
internal sealed partial class ProjectFile
{
    private readonly Dictionary<string, string> properties = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<string> sdks = [];
    private readonly List<ProjectItem> items = [];

    private ProjectFile(string path) => Path = path;

    public string Path { get; }

    public string Directory => System.IO.Path.GetDirectoryName(Path)!;

    /// <summary>SDK names without versions, from the root attribute, Sdk elements and Sdk imports.</summary>
    public IReadOnlyList<string> Sdks => sdks;

    public IReadOnlyList<ProjectItem> Items => items;

    /// <summary>The last unconditional value of a property, or null when it is unset or empty.</summary>
    public string? Property(string name) => properties.TryGetValue(name, out string? value) && value.Length > 0 ? value : null;

    public bool IsTrue(string name) => Property(name)?.Equals("true", StringComparison.OrdinalIgnoreCase) == true;

    public bool IsFalse(string name) => Property(name)?.Equals("false", StringComparison.OrdinalIgnoreCase) == true;

    public static ProjectFile Load(string project, string repositoryRoot)
    {
        ProjectFile file = new(System.IO.Path.GetFullPath(project));
        file.properties["MSBuildProjectDirectory"] = file.Directory;
        file.properties["MSBuildProjectName"] = System.IO.Path.GetFileNameWithoutExtension(file.Path);
        HashSet<string> read = new(StringComparer.Ordinal);
        // The SDK imports the nearest Directory.Build.props before the project body.
        if (BuildProps(file.Directory, repositoryRoot) is string props) file.Read(props, repositoryRoot, read);
        file.Read(file.Path, repositoryRoot, read);
        return file;
    }

    private static string? BuildProps(string directory, string repositoryRoot)
    {
        string root = System.IO.Path.GetFullPath(repositoryRoot);
        for (string? current = directory; current is not null; current = System.IO.Path.GetDirectoryName(current))
        {
            string props = System.IO.Path.Combine(current, "Directory.Build.props");
            if (File.Exists(props)) return props;
            if (string.Equals(current.TrimEnd(System.IO.Path.DirectorySeparatorChar), root.TrimEnd(System.IO.Path.DirectorySeparatorChar), StringComparison.Ordinal)) return null;
        }
        return null;
    }

    private void Read(string path, string repositoryRoot, HashSet<string> read)
    {
        if (!read.Add(path)) return;
        XElement xml = XDocument.Load(path).Root ?? throw new InvalidDataException($"Project XML has no root: {SourcePath.Relative(repositoryRoot, path)}.");
        string? outer = properties.GetValueOrDefault("MSBuildThisFileDirectory");
        properties["MSBuildThisFileDirectory"] = System.IO.Path.GetDirectoryName(path) + System.IO.Path.DirectorySeparatorChar;
        AddSdks((string?)xml.Attribute("Sdk"));
        foreach (XElement element in xml.Elements().Where(Unconditional))
        {
            switch (element.Name.LocalName)
            {
                case "Sdk":
                    AddSdks((string?)element.Attribute("Name"));
                    break;
                case "Import" when element.Attribute("Sdk") is XAttribute sdk:
                    AddSdks(sdk.Value);
                    break;
                case "Import":
                    if (Expand((string?)element.Attribute("Project"), path: true) is string imported
                        && System.IO.Path.GetFullPath(System.IO.Path.Combine(System.IO.Path.GetDirectoryName(path)!, Slashes(imported))) is string full
                        && File.Exists(full) && SourcePath.IsInside(repositoryRoot, full)) Read(full, repositoryRoot, read);
                    break;
                case "PropertyGroup":
                    foreach (XElement property in element.Elements().Where(Unconditional))
                        if (Expand(property.Value.Trim(), path: false) is string value) properties[property.Name.LocalName] = value;
                    break;
                case "ItemGroup":
                    foreach (XElement item in element.Elements().Where(Unconditional)) AddItem(item);
                    break;
            }
        }
        if (outer is null) properties.Remove("MSBuildThisFileDirectory");
        else properties["MSBuildThisFileDirectory"] = outer;
    }

    private static bool Unconditional(XElement element) => element.Attribute("Condition") is null;

    private void AddSdks(string? declared)
    {
        foreach (string sdk in (declared ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            string name = sdk.Split('/')[0].Trim();
            if (name.Length > 0 && !sdks.Contains(name, StringComparer.OrdinalIgnoreCase)) sdks.Add(name);
        }
    }

    private void AddItem(XElement item)
    {
        string? Attribute(string name) => item.Attribute(name) is XAttribute value ? Expand(value.Value, path: true) : null;
        Dictionary<string, string> metadata = new(StringComparer.OrdinalIgnoreCase);
        foreach (XAttribute attribute in item.Attributes().Where(attribute => attribute.Name.LocalName is not ("Include" or "Remove" or "Update" or "Exclude" or "Condition")))
            metadata[attribute.Name.LocalName] = attribute.Value.Trim();
        foreach (XElement child in item.Elements().Where(Unconditional)) metadata[child.Name.LocalName] = child.Value.Trim();
        // An include or remove that needs an unset property or a function stays unknown instead of naming the wrong files.
        if (item.Attribute("Include") is not null && Attribute("Include") is null) return;
        if (item.Attribute("Remove") is not null && Attribute("Remove") is null) return;
        items.Add(new ProjectItem(item.Name.LocalName, Attribute("Include"), Attribute("Remove"), Attribute("Exclude"), metadata));
    }

    /// <summary>
    /// Expands $(Name) from the properties read so far. In a property value an unset property is empty, as in MSBuild, so
    /// a value can extend one the SDK defines, such as DefineConstants. A path cannot: an item or import that names a
    /// property the scanner has not read, often one the SDK defines, stays unknown. Property functions, item lists and
    /// metadata are never evaluated and leave any value unknown.
    /// </summary>
    private string? Expand(string? text, bool path)
    {
        if (text is null) return null;
        bool unset = false;
        string expanded = PropertyReference().Replace(text, match =>
        {
            if (properties.TryGetValue(match.Groups[1].Value, out string? value)) return value;
            unset = true;
            return "";
        });
        return (unset && path) || expanded.Contains("$(", StringComparison.Ordinal) || expanded.Contains("@(", StringComparison.Ordinal)
            || expanded.Contains("%(", StringComparison.Ordinal) ? null : expanded;
    }

    public static string Slashes(string path) => path.Replace('\\', System.IO.Path.DirectorySeparatorChar).Replace('/', System.IO.Path.DirectorySeparatorChar);

    [GeneratedRegex(@"\$\(\s*([A-Za-z_][A-Za-z0-9_.\-]*)\s*\)")]
    private static partial Regex PropertyReference();
}
