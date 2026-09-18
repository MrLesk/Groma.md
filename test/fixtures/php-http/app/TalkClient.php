<?php
namespace App\Client;

use GuzzleHttp\Client;

const TALKS_PATH = '/api/talks';

final class TalkClient
{
    private object $cache;

    public function __construct(private Client $http)
    {
        $this->cache = new Cache();
    }

    public function list(): array
    {
        return $this->http->get(TALKS_PATH);
    }

    public function show(string $id): array
    {
        return $this->http->request('GET', "/api/talks/{$id}");
    }

    public function search(string $term): array
    {
        return $this->http->get("/api/talks/search-{$term}");
    }

    public function external(): array
    {
        return $this->http->get('https://talks.example.com/api/talks');
    }

    public function cached(): array
    {
        return $this->cache->get('/api/cached');
    }
}
