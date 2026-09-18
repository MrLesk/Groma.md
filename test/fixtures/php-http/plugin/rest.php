<?php
add_action('rest_api_init', function () {
    register_rest_route('shop/v1', '/orders', ['methods' => 'GET', 'callback' => 'shop_list_orders']);
    register_rest_route('shop/v1', '/orders/(?P<id>\d+)', [
        'methods' => WP_REST_Server::EDITABLE,
        'callback' => 'shop_update_order',
    ]);
    register_rest_route('shop/v1', '/orders/(?P<id>\d+)/items-(?P<index>\d+)', [
        'methods' => 'GET',
        'callback' => 'shop_order_item',
    ]);
    register_rest_route('shop/v1', '/health');
});

function shop_list_orders(): array
{
    return [];
}

function shop_update_order(int $id): array
{
    return [$id];
}

function shop_order_item(int $id): array
{
    return [$id];
}
