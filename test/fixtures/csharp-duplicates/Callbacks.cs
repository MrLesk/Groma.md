using System;

namespace Scheduling;

public static class Callbacks
{
    public static readonly Func<Step, bool> Ready = step =>
    {
        int finished = 0;
        foreach (Step dependency in step.Dependencies)
            if (dependency.Status == "done") finished++;
        return step.Status == "todo" && finished == step.Dependencies.Count && step.Assignee != null;
    };
}
