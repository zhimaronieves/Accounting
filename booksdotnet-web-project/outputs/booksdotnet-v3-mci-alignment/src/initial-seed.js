// The private local snapshot is optional and is not committed to Git.
const snapshots = import.meta.glob('./v3-initial-snapshot.json', { eager: true, import: 'default' });

export default snapshots['./v3-initial-snapshot.json'] ?? {};
