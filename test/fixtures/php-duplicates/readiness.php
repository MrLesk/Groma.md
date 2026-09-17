<?php
namespace Launch;

function isReady(array $checks, int $limit): bool
{
    $failed = 0;
    foreach ($checks as $check) {
        if (!$check->passed()) {
            $failed++;
        }
    }
    return $failed <= $limit;
}
