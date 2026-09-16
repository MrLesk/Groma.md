<section>
<?php
function renderItems(array $items): array {
    return array_map(fn($item) => strtoupper($item), $items);
}
?>
</section>
