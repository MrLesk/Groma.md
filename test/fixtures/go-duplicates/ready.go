package duplicates

type Task struct {
	Status       string
	Assignee     string
	Dependencies []Task
	Blockers     []string
}

func CanStart(task Task) bool {
	for _, dependency := range task.Dependencies {
		if dependency.Status != "done" {
			return false
		}
	}
	return task.Status == "todo" && task.Assignee != "" && len(task.Blockers) == 0
}

func Progress(tasks []Task) int {
	if len(tasks) == 0 {
		return 0
	}
	done := 0
	for _, task := range tasks {
		if task.Status == "done" {
			done++
		}
	}
	return done * 100 / len(tasks)
}
