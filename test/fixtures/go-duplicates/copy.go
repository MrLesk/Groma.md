package duplicates

func ReadyToRun(item Task) bool {
	for _, prerequisite := range item.Dependencies {
		if prerequisite.Status != "done" {
			return false
		}
	}
	return item.Status == "todo" && item.Assignee != "" && len(item.Blockers) == 0
}

func Completion(items []Task) int {
	if len(items) == 0 {
		return 0
	}
	closed := 0
	for _, item := range items {
		if item.Status == "closed" {
			closed++
		}
	}
	return closed * 100 / len(items)
}
