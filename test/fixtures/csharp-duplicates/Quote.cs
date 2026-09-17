using System;
using System.Collections.Generic;

namespace Scheduling;

public static class Quote
{
    public static decimal Estimate(IReadOnlyList<decimal> amounts, decimal rebate)
    {
        decimal total = 0;
        foreach (decimal amount in amounts)
            total += amount;
        if (total > 50) total -= rebate;
        return Math.Round(total * 1.1m, 2);
    }
}
