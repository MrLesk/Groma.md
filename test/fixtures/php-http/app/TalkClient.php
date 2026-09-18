<?php
namespace App\Client;

use GuzzleHttp\Client;

const TALKS_PATH = '/api/talks';

final class Paths
{
    const REPORT = '/reports/daily';
}

final class TalkClient
{
    private object $cache;

    public function __construct(private Client $http, Client $backup)
    {
        $this->cache = new Cache();
    }

    public function backup(): array
    {
        return $this->backup->get('/api/backup');
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

    public function featured(Client $client): array
    {
        return $client->get('/api/speakers/featured');
    }

    public function leaked($client): array
    {
        return $client->get('/api/talks/leaked');
    }

    public function replaced(Client $client): array
    {
        $client = new Cache();
        return $client->get('/api/talks/replaced');
    }

    public function constructed(): array
    {
        $client = new Client(['base_uri' => 'https://talks.example.com']);
        return $client->get('/api/talks/constructed');
    }

    public function archived(): array
    {
        return $this->http->get('/api/archive/latest');
    }

    public function sessions(): array
    {
        return $this->http->get('/api/sessions');
    }

    public function report(): array
    {
        return $this->http->get(Paths::REPORT);
    }

    public function foreignReport(): array
    {
        return $this->http->get(Reports::REPORT);
    }
}
