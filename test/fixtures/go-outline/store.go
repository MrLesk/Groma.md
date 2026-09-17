package outline

func (s *Store) Close() error { return nil }

type Store struct {
	items map[string]string
}

type Reader interface {
	Read(key string) (string, bool)
	Close() error
}

type Count int

type Alias = Store

type Pair[K comparable, V any] struct {
	key   K
	value V
}

var Normalize = func(value string) string { return value }

var logged = decorate(func() {})

func NewStore() *Store { return &Store{items: map[string]string{}} }

func (s *Store) Read(key string) (string, bool) {
	value, ok := s.items[key]
	return value, ok
}

func (p *Pair[K, V]) first() K { return p.key }

func (r remote) fetch() string { return string(r) }

func decorate(action func()) func() { return action }

func _() {}

func (s *Store) _() {}

func (Archive) _() {}
