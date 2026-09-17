<?php
namespace Launch;

final class Schedule
{
    public function canStart(array $steps, int $tolerance): bool
    {
        $blocked = 0;
        foreach ($steps as $step) {
            if (!$step->passed()) {
                $blocked++;
            }
        }
        return $blocked <= $tolerance;
    }
}
