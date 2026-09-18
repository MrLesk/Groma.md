<?php
namespace Example\Shop;

use Illuminate\Support\Facades\Route;

final class ShopServiceProvider
{
    public function boot(): void
    {
        Route::prefix('shop')->group(__DIR__ . '/../routes/shop.php');
    }
}
