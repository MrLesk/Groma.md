using System;
using System.Collections.Generic;

namespace Scheduling;

public static class Pricing
{
    public static decimal Total(IReadOnlyList<decimal> prices, decimal discount)
    {
        decimal sum = 0;
        foreach (decimal price in prices)
            sum += price;
        if (sum > 100) sum -= discount;
        return Math.Round(sum * 1.2m, 2);
    }
}
