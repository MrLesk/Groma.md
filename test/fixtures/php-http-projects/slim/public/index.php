<?php
use Slim\Factory\AppFactory;

$app = AppFactory::create();
$app->setBasePath('/myapp');
(require __DIR__ . '/../app/routes.php')($app);
$app->run();
