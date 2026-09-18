namespace Tokens;

public sealed class RowMajor
{
    public int this[int row, int column] => row * 100 + column * 10 + 1;
}

public sealed class RenamedRowMajor
{
    public int this[int r, int c] => r * 100 + c * 10 + 1;
}

public sealed class ColumnMajor
{
    public int this[int row, int column] => column * 100 + row * 10 + 1;
}

public sealed class RowMajorBlock
{
    public int this[int row, int column] { get { return row * 100 + column * 10 + 1; } }
}

public sealed class ColumnMajorBlock
{
    public int this[int row, int column] { get { return column * 100 + row * 10 + 1; } }
}
