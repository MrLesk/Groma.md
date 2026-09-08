package main

type identity struct {
	Language      string `json:"language"`
	Engine        string `json:"engine"`
	EngineVersion string `json:"engineVersion"`
}
type root struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
	File string `json:"file"`
}
type scope struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
type symbol struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Kind string `json:"kind"`
}
type sourceFile struct {
	File    string   `json:"file"`
	Symbols []symbol `json:"symbols"`
}
type placement struct {
	File  string `json:"file"`
	Scope string `json:"scope"`
}
type relationship struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Kind   string `json:"kind"`
}
type operation struct {
	ID       string `json:"id"`
	File     string `json:"file"`
	Name     string `json:"name"`
	Position int    `json:"position"`
}
type invocation struct {
	Source     string   `json:"source"`
	Targets    []string `json:"targets"`
	Unresolved bool     `json:"unresolved"`
	Line       int      `json:"line"`
	Position   int      `json:"position"`
	Member     string   `json:"member,omitempty"`
}
type diagnostic struct {
	Severity string `json:"severity"`
	Code     string `json:"code"`
	Message  string `json:"message"`
}
type observation struct {
	SchemaVersion int            `json:"schemaVersion"`
	Complete      bool           `json:"complete"`
	Scanner       identity       `json:"scanner"`
	Root          root           `json:"root"`
	Scopes        []scope        `json:"scopes"`
	Files         []sourceFile   `json:"files"`
	Placements    []placement    `json:"placements"`
	Relationships []relationship `json:"relationships"`
	Operations    []operation    `json:"operations"`
	Invocations   []invocation   `json:"invocations"`
	Diagnostics   []diagnostic   `json:"diagnostics"`
}
