using System.Collections.Generic;
using System.Linq;

namespace Tokens;

public static class Arithmetic
{
    public static int Grouped(int a, int b, int c) => (a + b) * c;

    public static int Ungrouped(int a, int b, int c) => a + b * c;

    public static int Wrapped(int a, int b, int c) => (a) + b * (c);

    public static bool Banded(int x) => x is > 0 and (< 10 or 20);

    public static bool Unbanded(int x) => x is > 0 and < 10 or 20;

    public static int Counted(int[][] rows) => (from row in rows select row).Count();

    public static IEnumerable<int> CountedRows(int[][] rows) => from row in rows select row.Count();

    public static int TrimmedLength(string? text) => (text?.Trim()).Length;

    public static int? MaybeTrimmedLength(string? text) => text?.Trim().Length;

    public static int Increment(int a)
    {
        a++;
        return a;
    }

    public static int Decrement(int a)
    {
        a--;
        return a;
    }
}
