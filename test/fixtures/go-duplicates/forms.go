package duplicates

type Hooks struct {
	Start func() error
}

var registered = map[string]bool{}

var initial = Register("forms")

func init() { registered["init"] = true }

var validate = func(name string) bool { return name != "" }

func Register(name string) bool {
	registered[name] = true
	return validate(name)
}

func (hooks *Hooks) Install(target *Hooks) {
	normalize := func(name string) string { return name }
	defaults := Hooks{Start: func() error { return nil }}
	Apply(Hooks{Start: func() error { return nil }})
	target.Merge(&Hooks{Start: func() error { return nil }})
	func() { normalize("install") }()
	*hooks = defaults
}

func Apply(hooks Hooks) {}

func (hooks *Hooks) Merge(other *Hooks) {}

func Labels(values []any) (found []string) {
	for _, value := range values {
		switch kind := value.(type) {
		case string:
			found = append(found, kind)
		}
	}
	return found
}

func Names(inputs []any) (result []string) {
	for _, input := range inputs {
		switch text := input.(type) {
		case string:
			result = append(result, text)
		}
	}
	return result
}

func Fact(n int) int {
	if n < 2 {
		return 1
	}
	return n * Fact(n-1)
}

func Factorial(n int) int {
	if n < 2 {
		return 1
	}
	return n * Factorial(n-1)
}

func Head(items []string, count int) []string { return items[:count] }

func Tail(items []string, count int) []string { return items[count:] }
