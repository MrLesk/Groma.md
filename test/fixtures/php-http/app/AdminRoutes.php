<?php
namespace App\Admin;

use Slim\Factory\AppFactory;
use Slim\Routing\RouteCollectorProxy;

final class PurgeAction
{
    public function __invoke(): bool
    {
        return true;
    }
}

$app = AppFactory::create();

$app->group('/admin', function (RouteCollectorProxy $group) {
    $group->post('/purge', PurgeAction::class);
});

$app->group('/beta/' . $base, function (RouteCollectorProxy $group) {
    $group->post('/purge', PurgeAction::class);
});

function cached_routes($cache): void
{
    $cache->group('/cached', function ($group) {
        $group->post('/purge', PurgeAction::class);
    });

    $cache->get('/api/talks', function () {
        return [];
    });
}
