<?php
namespace Shop\Support {
    function place_order(array $items): array
    {
        $count = function (array $lines): int {
            return count($lines);
        };
        return ['count' => $count($items)];
    }
}

namespace {
    $formatOrder = fn(array $order): string => implode(', ', $order);
    $formatters = ['order' => fn(array $order): string => implode(', ', $order)];

    if (!function_exists('order_label')) {
        function order_label(array $order): string
        {
            return implode(', ', $order);
        }
    }

    if (!function_exists('other_label')) {
        function mismatched_label(): string
        {
            return '';
        }
    }

    if (PHP_VERSION_ID >= 80000) {
        function version_label(): string
        {
            return PHP_VERSION;
        }
    }
}
