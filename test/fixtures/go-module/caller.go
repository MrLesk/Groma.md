package dispatch

import alias "example.test/dispatch/provider"

type Port interface { Work() }
type Actions struct { Apply func() }

var Initial = alias.Build()

func Wrap() *alias.Worker { return alias.Build() }

// 🧭 Keep compiler byte offsets distinct from shared UTF-16 source positions.
func Run(port Port, actions Actions) {
	worker := alias.Build()
	worker.Work()
	port.Work()
	actions.Apply()
	func() { alias.Build() }()
	Wrap()
}
