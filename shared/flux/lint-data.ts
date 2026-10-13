/**
 * Knowledge the advisory lint rules lean on: what well known images are, where they keep data and what they
 * typically need. This is general container knowledge (the images' own documentation), not Flux behaviour, so
 * every rule built on it is a warning or an info, never an error.
 *
 * Matching is on the repository part of the image (`mysql`, `bitnami/postgresql`, `itzg/minecraft-server`),
 * lower case, ignoring registry host and tag.
 *
 * Pure and framework-free. No Node built-ins, no DOM.
 */

export type ImageKind =
  | 'database'
  | 'cache'
  | 'game'
  | 'cms'
  | 'proxy'
  | 'monitoring'
  | 'queue'
  | 'search'
  | 'runtime';

export interface KnownImage {
  /** Human name for messages, for example "MySQL". */
  label: string;
  kind: ImageKind;
  /** Matches the repository (without registry host and tag). */
  match: RegExp;
  /** True when losing the container's disk loses something you care about. */
  stateful: boolean;
  /** Directories where the image keeps durable data. A mount at one of these keeps the data. */
  dataPaths: readonly string[];
  /** RAM the image typically needs to run comfortably, MB. */
  minRamMb: number;
  /** The port the image listens on by default. */
  defaultPort?: number;
  /** True for single-writer databases that must not run on a replicated (`r:`) mount with several writers. */
  singleWriterDb?: boolean;
}

export const KNOWN_IMAGES: readonly KnownImage[] = [
  {
    label: 'PostgreSQL',
    kind: 'database',
    match: /(^|\/)(postgres|postgresql|postgis)$/,
    stateful: true,
    dataPaths: ['/var/lib/postgresql/data', '/var/lib/postgresql', '/bitnami/postgresql'],
    minRamMb: 256,
    defaultPort: 5432,
    singleWriterDb: true,
  },
  {
    label: 'MySQL',
    kind: 'database',
    match: /(^|\/)mysql(-server)?$/,
    stateful: true,
    dataPaths: ['/var/lib/mysql'],
    minRamMb: 512,
    defaultPort: 3306,
    singleWriterDb: true,
  },
  {
    label: 'MariaDB',
    kind: 'database',
    match: /(^|\/)mariadb$/,
    stateful: true,
    dataPaths: ['/var/lib/mysql', '/bitnami/mariadb'],
    minRamMb: 256,
    defaultPort: 3306,
    singleWriterDb: true,
  },
  {
    label: 'MongoDB',
    kind: 'database',
    match: /(^|\/)mongo(db)?$/,
    stateful: true,
    dataPaths: ['/data/db', '/bitnami/mongodb'],
    minRamMb: 512,
    defaultPort: 27017,
    singleWriterDb: true,
  },
  {
    label: 'Redis',
    kind: 'cache',
    match: /(^|\/)(redis|valkey|keydb)$/,
    stateful: false,
    dataPaths: ['/data'],
    minRamMb: 64,
    defaultPort: 6379,
  },
  {
    label: 'Memcached',
    kind: 'cache',
    match: /(^|\/)memcached$/,
    stateful: false,
    dataPaths: [],
    minRamMb: 64,
    defaultPort: 11211,
  },
  {
    label: 'InfluxDB',
    kind: 'database',
    match: /(^|\/)influxdb$/,
    stateful: true,
    dataPaths: ['/var/lib/influxdb', '/var/lib/influxdb2'],
    minRamMb: 512,
    defaultPort: 8086,
    singleWriterDb: true,
  },
  {
    label: 'Elasticsearch',
    kind: 'search',
    match: /(^|\/)(elasticsearch|opensearch)$/,
    stateful: true,
    dataPaths: ['/usr/share/elasticsearch/data', '/usr/share/opensearch/data'],
    minRamMb: 2000,
    defaultPort: 9200,
  },
  {
    label: 'RabbitMQ',
    kind: 'queue',
    match: /(^|\/)rabbitmq$/,
    stateful: true,
    dataPaths: ['/var/lib/rabbitmq'],
    minRamMb: 256,
    defaultPort: 5672,
  },
  {
    label: 'Minecraft server',
    kind: 'game',
    match: /(^|\/)(minecraft-server|minecraft-bedrock-server|papermc\/paper)$/,
    stateful: true,
    dataPaths: ['/data'],
    minRamMb: 2000,
    defaultPort: 25565,
  },
  {
    label: 'WordPress',
    kind: 'cms',
    match: /(^|\/)wordpress$/,
    stateful: true,
    dataPaths: ['/var/www/html'],
    minRamMb: 256,
    defaultPort: 80,
  },
  {
    label: 'Ghost',
    kind: 'cms',
    match: /(^|\/)ghost$/,
    stateful: true,
    dataPaths: ['/var/lib/ghost/content'],
    minRamMb: 512,
    defaultPort: 2368,
  },
  {
    label: 'Nextcloud',
    kind: 'cms',
    match: /(^|\/)nextcloud$/,
    stateful: true,
    dataPaths: ['/var/www/html'],
    minRamMb: 512,
    defaultPort: 80,
  },
  {
    label: 'Grafana',
    kind: 'monitoring',
    match: /(^|\/)grafana(\/grafana(-oss)?)?$/,
    stateful: true,
    dataPaths: ['/var/lib/grafana'],
    minRamMb: 256,
    defaultPort: 3000,
  },
  {
    label: 'Prometheus',
    kind: 'monitoring',
    match: /(^|\/)prometheus$/,
    stateful: true,
    dataPaths: ['/prometheus'],
    minRamMb: 512,
    defaultPort: 9090,
  },
  {
    label: 'nginx',
    kind: 'proxy',
    match: /(^|\/)nginx$/,
    stateful: false,
    dataPaths: [],
    minRamMb: 32,
    defaultPort: 80,
  },
  {
    label: 'Apache httpd',
    kind: 'proxy',
    match: /(^|\/)httpd$/,
    stateful: false,
    dataPaths: [],
    minRamMb: 64,
    defaultPort: 80,
  },
  {
    label: 'Caddy',
    kind: 'proxy',
    match: /(^|\/)caddy$/,
    stateful: false,
    dataPaths: ['/data'],
    minRamMb: 32,
    defaultPort: 80,
  },
];

/** Images that are commonly larger than the 5 GB network limit on their larger variants. Approximate. */
export const HEAVY_IMAGE_PATTERNS: readonly { match: RegExp; label: string }[] = [
  { match: /(^|\/)tensorflow\/tensorflow$/, label: 'TensorFlow' },
  { match: /(^|\/)pytorch\/pytorch$/, label: 'PyTorch' },
  { match: /(^|\/)nvidia\/cuda$/, label: 'CUDA' },
  { match: /(^|\/)jupyter\/(datascience|tensorflow|pyspark)-notebook$/, label: 'Jupyter data science' },
  { match: /(^|\/)(rocm\/|huggingface\/)/, label: 'machine learning' },
];

/** Public ports databases and caches listen on. Exposing these publicly invites scans. */
export const DATABASE_PORTS: readonly number[] = [3306, 5432, 6379, 27017, 11211, 9200, 5672, 8086];

/** Environment variable names that usually hold a secret. */
export const SECRET_ENV_KEY =
  /(PASS(WORD|WD)?|SECRET|TOKEN|API[_-]?KEY|PRIVATE[_-]?KEY|CREDENTIAL|AUTH[_-]?KEY|ACCESS[_-]?KEY)/i;

/** Values that are obviously placeholders and not worth warning about. */
export const PLACEHOLDER_VALUE =
  /^(|changeme|change-me|example|your[-_ ].*|xxx+|\*+|<.*>|\$\{.*\}|\$[A-Z_]+)$/i;

/** The repository part of an image reference (no registry host, no tag, no digest), lower case. */
export function repositoryOf(repotag: string): string {
  let r = String(repotag ?? '');
  const at = r.indexOf('@');
  if (at >= 0) r = r.slice(0, at);
  const segs = r.split('/');
  const first = segs[0] ?? '';
  if (segs.length > 1 && (first.includes('.') || first.includes(':') || first === 'localhost')) segs.shift();
  let last = segs.pop() ?? '';
  const colon = last.lastIndexOf(':');
  if (colon >= 0) last = last.slice(0, colon);
  segs.push(last);
  return segs.join('/').toLowerCase();
}

export function knownImage(repotag: string): KnownImage | null {
  const repo = repositoryOf(repotag);
  if (!repo) return null;
  for (const k of KNOWN_IMAGES) if (k.match.test(repo)) return k;
  return null;
}
