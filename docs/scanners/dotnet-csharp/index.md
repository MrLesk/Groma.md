# .NET/C# scanner

Status: **TBD**

.NET/C# will have its own plugin implementing Groma's shared scanner-plugin interface. Its source contract will define
the .NET project evidence and architectural mapping understood by that plugin.

A scanner contract will be added only when a concrete .NET/C# example defines the architecture mapping. Shared scanner
concepts remain language-neutral, while .NET/C#-specific declarations and behavior belong in this directory.
