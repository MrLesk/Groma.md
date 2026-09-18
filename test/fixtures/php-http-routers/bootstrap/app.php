<?php
use Illuminate\Foundation\Application;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(web: __DIR__ . '/../web.php')
    ->create();
