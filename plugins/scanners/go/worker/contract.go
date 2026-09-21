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
type entryPoint struct {
	File        string   `json:"file"`
	Declaration string   `json:"declaration"`
	Name        string   `json:"name"`
	Files       []string `json:"files"`
}
type operation struct {
	ID       string `json:"id"`
	File     string `json:"file"`
	Name     string `json:"name"`
	Position int    `json:"position"`
	// A compared operation reports its range and tokens, even when its body has no tokens.
	StartLine int      `json:"startLine,omitzero"`
	EndLine   int      `json:"endLine,omitzero"`
	Tokens    []string `json:"tokens,omitzero"`
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
	SchemaVersion int            `json:"schemaVersion"`
	Roots         []root         `json:"roots"`
	Scanner       identity       `json:"scanner"`
	Files         []sourceFile   `json:"files"`
	EntryPoints   []entryPoint   `json:"entryPoints"`
	Operations    []operation    `json:"operations"`
	Invocations   []invocation   `json:"invocations"`
	HTTPEndpoints []httpEndpoint `json:"httpEndpoints"`
	HTTPRequests  []httpRequest  `json:"httpRequests"`
	Diagnostics   []diagnostic   `json:"diagnostics"`
}

// Source outline: a Groma SourceReference in, a CodeFile out.
type reference struct {
	File    string   `json:"file"`
	Symbols []string `json:"symbols"`
}
type codeSymbol struct {
	Name       string `json:"name"`
	Line       int    `json:"line"`
	Visibility string `json:"visibility"`
	Entry      bool   `json:"entry"`
}
type codeDeclaration struct {
	Kind string `json:"kind"`
	codeSymbol
	// Types always list members; functions omit them.
	Members []codeSymbol `json:"members,omitzero"`
}
type codeFile struct {
	File         string            `json:"file"`
	Declarations []codeDeclaration `json:"declarations"`
}

// HTTP facts: what this application serves and requests.
type endpointSegment struct {
	Kind        string `json:"kind"`
	Value       string `json:"value,omitzero"`
	Name        string `json:"name,omitzero"`
	Optional    bool   `json:"optional,omitzero"`
	Constrained bool   `json:"constrained,omitzero"`
}
type httpEndpoint struct {
	Operation string            `json:"operation"`
	Method    string            `json:"method"`
	Path      []endpointSegment `json:"path"`
}

type requestSegment struct {
	Kind  string `json:"kind"`
	Value string `json:"value,omitzero"`
}
type httpRequest struct {
	Operation string `json:"operation"`
	Method    string `json:"method,omitzero"`
	// The path follows a configuration value this scan cannot read.
	Configured bool             `json:"configured,omitzero"`
	Path       []requestSegment `json:"path"`
}
