<?php
declare(strict_types=1);

namespace Shop;

interface Priced
{
    public function total(): float;
}

abstract class OrderService implements Priced
{
    private const LIMIT = 10;
    protected array $orders = [];

    public function __construct(private Clock $clock)
    {
    }

    abstract protected function store(Order $order): void;

    private static function limit(): int
    {
        $label = fn() => 'nested';
        return self::LIMIT;
    }

    function total(): float
    {
        return 0.0;
    }
}

trait Audited
{
    public static function audit(): void
    {
    }
}

enum Status: string
{
    case Open = 'open';

    public function label(): string
    {
        return ucfirst($this->value);
    }
}
