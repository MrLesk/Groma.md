<?php
namespace App\Api;

use App\Routing\Paths;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/speakers')]
final class SpeakerController
{
    #[Route('/{id}', name: 'speaker_show', methods: ['GET'])]
    public function show(int $id): array
    {
        return [$id];
    }

    #[Route('', methods: 'POST')]
    public function create(): array
    {
        return [];
    }

    #[Route('/{id}/photo-{size}', methods: ['GET'])]
    public function photo(int $id, string $size): array
    {
        return [$id, $size];
    }
}

#[Route(Paths::DRAFTS)]
final class DraftController
{
    #[Route('/{id}', methods: ['GET'])]
    public function show(int $id): array
    {
        return [$id];
    }
}
