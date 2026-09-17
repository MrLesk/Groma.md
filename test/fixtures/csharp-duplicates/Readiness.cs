using System.Collections.Generic;

namespace Scheduling;

public sealed record Step(string Status, IReadOnlyList<Step> Dependencies, string? Assignee);

public static class Readiness
{
    public static bool CanStart(Step step)
    {
        int finished = 0;
        foreach (Step dependency in step.Dependencies)
            if (dependency.Status == "done") finished++;
        return step.Status == "todo" && finished == step.Dependencies.Count && step.Assignee != null;
    }
}
