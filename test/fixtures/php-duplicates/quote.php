<?php
namespace Billing;

final class Quote
{
    private float $total;

    public function __construct(array $items, float $taxRate)
    {
        $sum = 0.0;
        foreach ($items as $item) {
            $sum += $item['price'] * $item['quantity'];
        }
        $tax = round($sum * $taxRate, 2);
        $this->total = $sum + $tax;
    }
}
