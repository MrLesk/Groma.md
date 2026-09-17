namespace Scheduling;

public static class Checks
{
    public static bool IsOpen(Step step) => step.Status == "todo" && step.Assignee != null;

    public static bool IsClaimed(Step step) => step.Status == "todo" && step.Assignee == null;
}
