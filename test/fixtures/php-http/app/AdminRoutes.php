<?php
namespace App\Admin;

final class PurgeAction
{
    public function __invoke(): bool
    {
        return true;
    }
}

$app->group('/admin', function ($group) {
    $group->post('/purge', PurgeAction::class);
});

$app->group($base . '/beta', function ($group) {
    $group->post('/purge', PurgeAction::class);
});
