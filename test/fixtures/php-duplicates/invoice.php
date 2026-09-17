<?php
namespace Billing;

function invoiceTotal(array $lines, float $taxRate): float
{
    $total = 0.0;
    foreach ($lines as $line) {
        $total += $line['price'] * $line['quantity'];
    }
    $tax = round($total * $taxRate, 2);
    return $total + $tax;
}
