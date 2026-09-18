<?php
namespace App\Http;

final class TalkController
{
    public function index(): array
    {
        return [];
    }

    public function comment(int $id): array
    {
        return [$id];
    }

    public function show(int $id): array
    {
        return [$id];
    }

    public function destroy(int $id): bool
    {
        return true;
    }
}
