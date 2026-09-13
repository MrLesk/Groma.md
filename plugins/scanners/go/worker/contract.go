package main

type identity struct {
	ID            string `json:"id"`
	Technology    string `json:"technology"`
	Engine        string `json:"engine"`
	EngineVersion string `json:"engineVersion"`
}
type root struct {
	ID     string `json:"id"`
	Parent string `json:"parent,omitempty"`
	Kind   string `json:"kind"`
	Name   string `json:"name"`
	File   string `json:"file,omitempty"`
}
type symbol struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Kind string `json:"kind"`
}
type sourceFile struct {
	Roots   []string `json:"roots"`
	File    string   `json:"file"`
	Symbols []symbol `json:"symbols"`
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
	File     string `json:"file,omitempty"`
	Line     int    `json:"line,omitempty"`
	Severity string `json:"severity"`
	Code     string `json:"code"`
	Message  string `json:"message"`
}
type observation struct {
	SchemaVersion int          `json:"schemaVersion"`
	Roots         []root       `json:"roots"`
	Scanner       identity     `json:"scanner"`
	Files         []sourceFile `json:"files"`
	Operations    []operation  `json:"operations"`
	Invocations   []invocation `json:"invocations"`
	Diagnostics   []diagnostic `json:"diagnostics"`
}
