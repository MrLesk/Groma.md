<?php
namespace Launch;

$isReady = function (array $checks): bool {
    $failed = 0;
    foreach ($checks as $check) {
        if (!$check->passed()) {
            $failed++;
        }
    }
    return $failed === 0;
};

$canStart = function (array $steps): bool {
    $blocked = 0;
    foreach ($steps as $step) {
        if (!$step->passed()) {
            $blocked++;
        }
    }
    return $blocked === 0;
};

$invoices = register([
    'total' => fn(array $lines) => array_sum(array_map(fn($line) => $line['price'] * $line['quantity'], $lines)),
]);

$quotes = register([
    'total' => fn(array $items) => array_sum(array_map(fn($item) => $item['price'] * $item['quantity'], $items)),
]);
