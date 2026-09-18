<?php
namespace Billing;

function discountEach(array $prices): array
{
    foreach ($prices as &$price) {
        $price = round($price * 0.9, 2);
    }
    return $prices;
}

function discountCopies(array $prices): array
{
    foreach ($prices as $price) {
        $price = round($price * 0.9, 2);
    }
    return $prices;
}

function grossBeforeRate(float $net, float $fee, float $rate): float
{
    return round(($net + $fee) * $rate, 2);
}

function grossAfterRate(float $net, float $fee, float $rate): float
{
    return round($net + $fee * $rate, 2);
}

function collectTotals(array $totals, float $tax): callable
{
    return function (float $amount) use (&$totals, $tax) {
        $totals[] = $amount * $tax;
    };
}

function collectTaxes(array $totals, float $tax): callable
{
    return function (float $amount) use ($totals, &$tax) {
        $totals[] = $amount * $tax;
    };
}
