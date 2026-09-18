<?php
namespace App\Api;

use App\Routing\Paths;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/speakers')]
final class SpeakerController
{
    #[Route('/{id<\d+>}', name: 'speaker_show', methods: ['GET'])]
    public function show(int $id): array
    {
        return [$id];
    }

    #[Route('', methods: 'POST')]
    public function create(): array
    {
        return [];
    }

    #[Route('/{id}/photo-{size}', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function photo(int $id, string $size): array
    {
        return [$id, $size];
    }
}

#[Route('/drafts/' . Paths::DRAFTS)]
final class DraftController
{
    #[Route('/{id}', methods: ['GET'])]
    public function show(int $id): array
    {
        return [$id];
    }
}

#[Route('/ratings/{id}', methods: ['GET'])]
final class RateSpeaker
{
    public function __invoke(int $id): array
    {
        return [$id];
    }
}

#[Route('/reviews')]
final class ReviewController
{
    #[Route('/{id}', methods: ['GET'])]
    public function show(int $id): array
    {
        return [$id];
    }

    public function __invoke(): array
    {
        return [];
    }
}
