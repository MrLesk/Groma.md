package provider

type Worker struct{}

func Build() *Worker { return &Worker{} }
func (w *Worker) Work() {}
