using System.Text;
using Groma.CSharpScanner;

// The adapter writes UTF-8 whatever the locale, while Console.In decodes with the locale's encoding.
using StreamReader standardInput = new(Console.OpenStandardInput(), new UTF8Encoding(false));
return await ScannerCommand.RunAsync(args, standardInput, Console.Out, Console.Error);
