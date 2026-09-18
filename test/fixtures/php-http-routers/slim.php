<?php
use Slim\App;
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

$app->group('/imports', function (RouteCollectorProxy $group) use ($app) {
    $app = legacy_app();
    $app->get('/reassigned', function () {
        return 'reassigned';
    });
});

$other = AppFactory::create();
$other->get('/other', function () {
    return 'other';
});
$replace = function () use (&$other) {
    $other = legacy_app();
};

$admin = AppFactory::create();
$admin->setBasePath('/admin');
$admin->get('/users', function () {
    return 'users';
});

function typed_routes(App $typed): void
{
    $typed->get('/typed', function () {
        return 'typed';
    });
}

$twice = AppFactory::create();
$twice->setBasePath('/one');
$twice->setBasePath('/two');
$twice->get('/twice', function () {
    return 'twice';
});

$constructed = new App();
$constructed->get('/constructed', function () {
    return 'constructed';
});

$hidden = function () {
    $app->get('/hidden', function () {
        return 'hidden';
    });
};

function destructured(): void
{
    $app = AppFactory::create();
    [$app] = legacy_apps();
    $app->get('/destructured', function () {
        return 'destructured';
    });
}

function iterated(): void
{
    $app = AppFactory::create();
    foreach (legacy_apps() as $app) {
        $app->get('/iterated', function () {
            return 'iterated';
        });
    }
}

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
