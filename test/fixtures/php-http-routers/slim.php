<?php
use Slim\Factory\AppFactory;
use Slim\Routing\RouteCollectorProxy;

$app = AppFactory::create();

$app->group('/api', function (RouteCollectorProxy $group) use ($app) {
    $group->get('/talks', function () {
        return 'talks';
    });
    $app->get('/status', function () {
        return 'status';
    });
});

$legacy = AppFactory::create();
if (getenv('LEGACY')) {
    $legacy = legacy_app();
}
$legacy->get('/legacy', function () {
    return 'legacy';
});

function mount_reports(RouteCollectorProxy $reports): void
{
    $reports->get('/daily', function () {
        return 'daily';
    });
}

function sub_application(): void
{
    $app = AppFactory::create();
    $app->setBasePath('/sub');
    $app->get('/based', function () {
        return 'based';
    });
}
