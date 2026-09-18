<?php
use Slim\App;
use Slim\Routing\RouteCollectorProxy;

return function (App $app) {
    $app->get('/talks', function () {
        return 'talks';
    });
    $app->group('/api', function (RouteCollectorProxy $group) {
        $group->get('/sessions', function () {
            return 'sessions';
        });
    });
};
