namespace Scheduling;

public sealed class Runner
{
    public bool ReadyToRun(Step job)
    {
        int completed = 0;
        foreach (Step parent in job.Dependencies)
            if (parent.Status == "done") completed++;
        return job.Status == "todo" && completed == job.Dependencies.Count && job.Assignee != null;
    }
}
