/**
 * Content of /reference/docker: image names and tags, architecture, registries, size, binding, users,
 * logs, health, stateless design, the Dockerfile patterns and the troubleshooting table.
 *
 * Sources are FACTS.md sections 3.3, 3.6 and 3.7 (the image rules), 6.1 and 6.3 (install and restarts),
 * 7.3 (limits and mechanics), 8 (networking) and 11 (common mistakes). Statements that FACTS.md marks
 * UNVERIFIED carry that chip. Limits come from the engine.
 */

import {
  defaultComponent,
  defaultSpec,
  KNOWN_IMAGES,
  knownImage,
  LIMITS,
  lintSpec,
  type ParsedRepotag,
  parseRepotag,
} from '@shared/flux';
import { andList, num, orList } from './derive';
import { DOCKER_WEB_PORT, TAG_EXAMPLES } from './examples';
import { CHECKED, IMAGE_TAG, NODE, SNAPSHOT, SPAWN_DELAY_MIN, WINDOWS } from './facts';
import type { FactRow, Provenance, TroubleRow } from './types';

/** 5000000000 -> "5 GB". Decimal gigabytes, as Docker registries report sizes. */
export function gbText(bytes: number): string {
  return `${String(bytes / 1_000_000_000)} GB`;
}

// ---------------------------------------------------------------------------
// Image names
// ---------------------------------------------------------------------------

export interface ImageFinding {
  repotag: string;
  parsed: ParsedRepotag;
  /** Image and repotag lint codes the engine raises for it, in order. */
  codes: readonly string[];
}

/** Parse an image reference and ask the linter what it thinks of it. Pure, never throws. */
export function imageFindings(repotag: string): ImageFinding {
  const spec = defaultSpec();
  spec.compose = [defaultComponent({ repotag })];
  const report = lintSpec(spec);
  const codes = report.issues
    .map((i) => i.code)
    .filter((c) => c.startsWith('IMAGE_') || c.startsWith('REPOTAG_'));
  return { repotag, parsed: parseRepotag(repotag), codes: [...new Set(codes)] };
}

export function buildImageNameFacts(): FactRow[] {
  const R = LIMITS.repotag;
  return [
    {
      id: 'grammar',
      label: 'Grammar',
      text: `\`[HOST[:PORT]/][NAMESPACE/]REPOSITORY[:TAG]\`, up to ${R.maxLength} characters and no spaces. A tag is letters, digits, underscores, dots and hyphens, up to ${IMAGE_TAG.maxLength} characters, and does not start with a dot or a hyphen.`,
      prov: ['source'],
    },
    {
      id: 'lookup',
      label: 'What is checked',
      text: 'When you register, the network looks the image up in its registry. It must exist, be pullable without credentials (unless the app is enterprise) and have a usable architecture and size.',
      prov: ['source'],
    },
    {
      id: 'no-host',
      label: 'No host',
      text: 'An image with no host is pulled from Docker Hub. By the usual Docker rule, the first part counts as a host only when it contains a dot or a colon, or is `localhost`.',
      prov: ['inference'],
    },
    {
      id: 'lower',
      label: 'Lower case',
      text: 'Repository and namespace names are lower case. FluxOS refuses a reference with capitals ("not in valid format") before any pull, and registries require lower case too.',
      prov: ['source', 'live'],
    },
  ];
}

export function buildTagFacts(): FactRow[] {
  return [
    {
      id: 'recheck',
      label: 'What a moving tag costs',
      text: `FluxOS is set to ask the registry about every ${NODE.imageCheckHours} hours for a changed image under the same tag and to redeploy it. If that happens, behaviour can change under a running app, and for a while different nodes can run different builds.`,
      prov: ['source', 'unverified'],
    },
    {
      id: 'redeploy',
      label: 'What was not observed',
      text: 'The interval is read from the node configuration. That a new digest triggers a soft redeploy is inferred from the source and was not watched on a live app.',
      prov: ['inference', 'unverified'],
    },
    {
      id: 'pin',
      label: 'What to pin',
      text: `Use a full version tag that you never move, such as \`${TAG_EXAMPLES.pinned}\` or your own \`${TAG_EXAMPLES.own}\`. A tag like \`${TAG_EXAMPLES.moving}\` still moves inside a major version.`,
      prov: ['inference'],
    },
    {
      id: 'digest',
      label: 'A digest',
      text: "A digest, `name@sha256:...`, is the most exact pin. The engine parses it. Whether the network's registry check accepts a digest reference was not tested, so prefer an immutable tag.",
      prov: ['unverified'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Architecture, registries, size
// ---------------------------------------------------------------------------

export function buildArchitectureFacts(): FactRow[] {
  const archs = orList(LIMITS.repotag.architectures.map((a) => `\`${a}\``));
  const enterprise = andList(LIMITS.enterprise.requiredArchitectures.map((a) => `\`${a}\``));
  return [
    {
      id: 'supported',
      label: 'What the network accepts',
      text: `An image needs a ${archs} build. Every component of an app must share at least one architecture.`,
      prov: ['source'],
    },
    {
      id: 'enterprise',
      label: 'Enterprise apps',
      text: `Every component needs ${enterprise}, because ArcaneOS nodes are amd64 only.`,
      prov: ['source'],
    },
    {
      id: 'mac',
      label: 'The Apple silicon trap',
      text: `An image built on an Apple silicon Mac is arm64 only. A public app with an arm64-only image is accepted, but only a handful of nodes can run it (${SNAPSHOT.arm64Nodes} on ${CHECKED.date}, none of them on ArcaneOS), so the app stays short of instances. An enterprise app is refused, because it needs amd64 for every component. "Does not have a valid architecture" is the message for an image with neither amd64 nor arm64. Build for amd64 or for both.`,
      prov: ['source', 'live'],
    },
  ];
}

export function buildRegistryFacts(): FactRow[] {
  const L = LIMITS.repoauth;
  return [
    {
      id: 'public',
      label: 'Public images',
      text: 'A public image from Docker Hub needs nothing more than its name. Another registry needs its host in front, for example `ghcr.io/owner/app:1.0.0`.',
      prov: ['source'],
    },
    {
      id: 'dockerio',
      label: 'The docker.io prefix',
      text: 'Leave `docker.io/` off. Docker Hub images need no host, and an explicit `docker.io/` prefix failed the image lookup with "Unsupported schemaVersion: undefined" when tested.',
      prov: ['source', 'live'],
    },
    {
      id: 'private',
      label: 'Private images',
      text: `Only enterprise apps may use them, with credentials in \`repoauth\` (up to ${num(L.maxLength)} characters). In a public spec the credentials would be readable by everyone, so the network refuses it.`,
      prov: ['source'],
    },
    {
      id: 'formats',
      label: 'repoauth formats',
      text: '`username:token`, or a provider address that starts with `aws-ecr://`, `azure-acr://` or `google-gar://`. The Simple mode form hint shows shorter names (`aws://`, `azure://`, `google://`) that the source read does not register. Use a token that can only pull.',
      prov: ['source', 'docs', 'unverified'],
    },
    {
      id: 'whitelist',
      label: 'No whitelist, but a blocklist',
      text: 'There is no list of allowed images. A signed network policy blocks some owners, images, hashes and registry namespaces, and an app that matches is refused at validation or at install.',
      prov: ['source', 'live'],
    },
    {
      id: 'rate',
      label: 'Docker Hub limits',
      text: 'Docker Hub limits anonymous pulls. That is general Docker Hub behaviour and was not measured on Flux nodes.',
      prov: ['inference'],
    },
  ];
}

export function buildSizeFacts(): FactRow[] {
  const bytes = LIMITS.repotag.maxImageBytes;
  return [
    {
      id: 'limit',
      label: 'The size limit',
      text: `${gbText(bytes)}: the compressed layers of the image may add up to at most ${num(bytes)} bytes. The validate step says the image "size is over Flux limit" when they do not.`,
      prov: ['source'],
    },
    {
      id: 'pull',
      label: 'Install time',
      text: 'Pulling the image is the dominant cost of an install. A big image takes seconds to tens of minutes on a node, and every node pulls it on its own.',
      prov: ['source'],
    },
    {
      id: 'promise',
      label: 'What the form says',
      text: `FluxCloud's screen says deployment takes "up to ${WINDOWS.deployUpToMin} minutes after payment". That is an estimate, not a guarantee. Bigger nodes wait before taking a small app (${SPAWN_DELAY_MIN.nimbusSmall}, ${SPAWN_DELAY_MIN.stratusMedium} or ${SPAWN_DELAY_MIN.stratusSmall} minutes), so a copy can take about two hours, and longer when few nodes qualify. A node that takes the app usually starts installing within 1 to 3 minutes.`,
      prov: ['source'],
    },
    {
      id: 'ladder',
      label: 'If it crashes at start',
      text: `FluxOS restarts a container that exits at once the first time, then waits ${andList(
        NODE.restartLadderSec.slice(1).map((s) => (s < 60 ? `${s} s` : `${s / 60} min`)), // literal: seconds per minute
      )} between further restarts. A run of ${NODE.stableRunMin} minutes without a crash resets the ladder. ${NODE.crashRestarts} automatic restarts in ${NODE.crashWindowMin} minutes count as a crash.`,
      prov: ['source'],
    },
    {
      id: 'ready',
      label: 'When traffic arrives',
      text: 'The load balancer checks each published port with a TCP connect. An instance whose port stops accepting connections leaves rotation after two failed checks and returns after two successes. Whether a brand new instance gets traffic before its first checks pass was not tested.',
      prov: ['source', 'unverified'],
    },
    {
      id: 'slim',
      label: 'How to keep it small',
      text: 'Use a slim or alpine base, build in one stage and run from another, leave tools and caches out of the last stage, and download data at start or keep it on the volume instead of in the image.',
      prov: ['inference'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Binding, users, logs, health
// ---------------------------------------------------------------------------

export function buildBindingFacts(): FactRow[] {
  return [
    {
      id: 'rule',
      label: 'The rule',
      text: "Listen on `0.0.0.0` on the container port. Docker forwards a published port to the container's bridge address, so a process on `127.0.0.1` or `localhost` accepts nothing from outside the container.",
      prov: ['source', 'inference'],
    },
    {
      id: 'match',
      label: 'Match the spec',
      text: 'The port the process listens on and `containerPorts[i]` must be the same number. Read the port from an environment variable and set the same value in the spec.',
      prov: ['source'],
    },
    {
      id: 'expose',
      label: 'EXPOSE',
      text: 'The `EXPOSE` line in a Dockerfile is documentation. Flux publishes what `ports` and `containerPorts` say.',
      prov: ['source', 'inference'],
    },
  ];
}

/** FACTS 3.3 (limits), 8.4 (injected variables, visibility) and 3.7 (how `commands` is passed). */
export function buildEnvFacts(): FactRow[] {
  const E = LIMITS.environment;
  const C = LIMITS.commands;
  return [
    {
      id: 'format',
      label: 'Variables',
      text: `\`environmentParameters\` holds \`KEY=value\` strings, up to ${E.maxCount} per component and ${E.maxLength} characters each. Each one is an environment variable of the container, read the usual way.`,
      prov: ['source'],
    },
    {
      id: 'injected',
      label: 'Set by Flux',
      text: '`FLUX_APP_NAME` and `FLUX_NODE_HOST_IP` are added last and win over a variable of the same name, so do not set them.',
      prov: ['source'],
    },
    {
      id: 'commands',
      label: 'Commands',
      text: `\`commands\` is a list of up to ${C.maxCount} arguments of up to ${C.maxLength} characters each. It becomes the container's command, after the image's ENTRYPOINT: one argument per entry, not a shell line.`,
      prov: ['source'],
    },
    {
      id: 'readable',
      label: 'Who can read them',
      text: 'In a public app anyone can read every variable and command at `/apps/appspecifications/<name>`. Keep secrets out of them, or register the app as an enterprise app, which encrypts the spec.',
      prov: ['docs', 'live'],
    },
    {
      id: 'port',
      label: 'The port',
      text: 'Let the process read its port from a variable such as `PORT` and put the same number in `containerPorts`. The linter warns when they differ.',
      prov: ['inference'],
    },
    {
      id: 'reserved',
      label: 'Reserved entries',
      text: '`F_S_ENV=`, `F_S_CMD=` and `LOG=` entries are read by Flux itself. They are explained with the host service in [Environment and the host service](/reference/networking#environment).',
      prov: ['source'],
    },
  ];
}

export function buildUserFacts(): FactRow[] {
  return [
    {
      id: 'user',
      label: 'Running as a user',
      text: 'Set `USER` to a non-root user in the Dockerfile. Nothing in Flux requires root, and a container that does not run as root limits what a bug can do.',
      prov: ['inference'],
    },
    {
      id: 'low-ports',
      label: `Ports below ${LIMITS.ports.privilegedBelow}`,
      text: `Some images need root to listen below ${LIMITS.ports.privilegedBelow}. Flux does not enforce this and many images work without it, so treat it as a heads-up, not a rule. A high port inside the container is the safe choice. The public port can be anything.`,
      prov: ['unverified'],
    },
    {
      id: 'volume',
      label: 'The volume owner',
      text: 'Before a node starts the container, FluxOS fixes the owner of the volume to what the container expects. An image that runs as a non-root user may still need its own `chown` at start. The symptom is "permission denied" on the data folder.',
      prov: ['source', 'unverified'],
    },
    {
      id: 'privileged',
      label: '--privileged',
      text: 'Flux removes a `--privileged` argument from `commands`. Containers do not get extra host privileges.',
      prov: ['source'],
    },
  ];
}

export function buildLogFacts(): FactRow[] {
  return [
    {
      id: 'stdout',
      label: 'Where to write',
      text: 'Write logs to standard output and standard error. That is where Docker, and so the Logs tab of the app, reads them.',
      prov: ['inference'],
    },
    {
      id: 'size',
      label: 'How much is kept',
      text: `The json-file driver keeps ${NODE.logFiles} files and about ${NODE.logTotalMb} MB in total per container, unless log shipping is set up. Older lines roll over and are gone.`,
      prov: ['source'],
    },
    {
      id: 'viewer',
      label: 'The Logs tab',
      text: 'The FluxCloud Log Viewer picks a component, a line count and a start time, filters by keyword, and can copy or download. It tells you when earlier logs rolled over on that node.',
      prov: ['source'],
    },
    {
      id: 'ship',
      label: 'Shipping',
      text: 'Set `LOG=COLLECT` on one component and `LOG=SEND` on the others to ship container logs to the collector inside the app.',
      prov: ['source'],
    },
    {
      id: 'files',
      label: 'Log files',
      text: 'A log file on the volume counts against `hdd` and can fill it. Rotate or cap it.',
      prov: ['source', 'inference'],
    },
  ];
}

export function buildHealthFacts(): FactRow[] {
  return [
    {
      id: 'healthcheck',
      label: 'HEALTHCHECK',
      text: 'FluxOS does not read a Docker `HEALTHCHECK`. A container counts as healthy while it is running.',
      prov: ['source'],
    },
    {
      id: 'restart',
      label: 'Restart policy',
      text: 'The Docker restart policy is `no`. FluxOS restarts containers that exit, with the back-off ladder above.',
      prov: ['source'],
    },
    {
      id: 'port',
      label: 'The only outside check',
      text: 'The load balancer checks that each published port accepts a TCP connection. A process that hangs but keeps its port open stays in rotation.',
      prov: ['source', 'inference'],
    },
    {
      id: 'exit',
      label: 'What to do',
      text: 'Make the process exit when it is broken, so Flux restarts it, and run more than one instance so the others carry the load meanwhile.',
      prov: ['source'],
    },
  ];
}

export function buildStatelessFacts(): FactRow[] {
  return [
    {
      id: 'replace',
      label: 'Any instance can go',
      text: 'A node can disappear at any time. The replacement starts on another node with a new container and, for a plain volume, an empty one.',
      prov: ['source'],
    },
    {
      id: 'state',
      label: 'Where state goes',
      text: 'Keep it in a `g:` volume for a single writer, in an `r:` volume only for data that tolerates replication conflicts, or in a service outside the app. Never rely on the container filesystem. Which of `g:` and `r:` suits which data is a design judgement, not a rule Flux states.',
      prov: ['source', 'inference', 'unverified'],
    },
    {
      id: 'rootfs',
      label: 'The container filesystem',
      text: `Writes outside a volume go to the container's own layer, capped at ${NODE.rootfsGb} GB on nodes whose Docker uses XFS project quota. The cap depends on the node and is not part of \`hdd\`.`,
      prov: ['source'],
    },
    {
      id: 'sessions',
      label: 'Sessions',
      text: 'A client is pinned to one instance by a cookie for a while, but not for ever, and an instance can vanish. Keep sessions in a shared store or in a signed cookie.',
      prov: ['source', 'inference'],
    },
    {
      id: 'config',
      label: 'Configuration',
      text: 'Take configuration from environment variables, which are the same on every instance, and keep secrets out of a public spec.',
      prov: ['source'],
    },
  ];
}

// ---------------------------------------------------------------------------
// Known images
// ---------------------------------------------------------------------------

export interface CommonImageRow {
  id: string;
  label: string;
  kind: string;
  port: number | null;
  dataPaths: readonly string[];
  minRamMb: number;
  stateful: boolean;
  singleWriter: boolean;
}

/** What the linter knows about familiar images. General container knowledge, not Flux behaviour. */
export function buildCommonImages(): CommonImageRow[] {
  return KNOWN_IMAGES.map((k, i) => ({
    id: `image-${i}`,
    label: k.label,
    kind: k.kind,
    port: k.defaultPort ?? null,
    dataPaths: k.dataPaths,
    minRamMb: k.minRamMb,
    stateful: k.stateful,
    singleWriter: k.singleWriterDb === true,
  }));
}

// ---------------------------------------------------------------------------
// Dockerfile patterns
// ---------------------------------------------------------------------------

export interface DockerfileNote {
  id: string;
  /** The line or lines it is about. */
  lines: string;
  /** Markup. */
  text: string;
  prov: readonly Provenance[];
}

export function buildWebNotes(): DockerfileNote[] {
  return [
    {
      id: 'stages',
      lines: 'FROM ... AS build',
      text: 'Two stages: the first builds, the last only runs. Compilers and dev dependencies never reach the image that is pulled by every node.',
      prov: ['inference'],
    },
    {
      id: 'cache',
      lines: 'COPY the package files, RUN npm ci',
      text: 'Copy the package files and install before copying the source, so a code change does not repeat the install.',
      prov: ['inference'],
    },
    {
      id: 'bind',
      lines: `ENV HOST=0.0.0.0 PORT=${DOCKER_WEB_PORT}`,
      text: 'The server reads both and binds all interfaces. Put the same port in `containerPorts` and in `environmentParameters`.',
      prov: ['source', 'inference'],
    },
    {
      id: 'user',
      lines: 'USER node',
      text: 'The process runs as a non-root user. If it writes to a volume, make sure that user owns the folder at start.',
      prov: ['inference', 'unverified'],
    },
    {
      id: 'expose',
      lines: `EXPOSE ${DOCKER_WEB_PORT}`,
      text: 'Documentation only. Flux publishes `ports` and `containerPorts` from the spec.',
      prov: ['source'],
    },
    {
      id: 'cmd',
      lines: 'CMD [...]',
      text: "Leave `commands` empty and the image's own CMD runs. A `commands` list replaces it, one argument per entry.",
      prov: ['source'],
    },
  ];
}

export function buildStaticNotes(): DockerfileNote[] {
  return [
    {
      id: 'build',
      lines: 'FROM node ... AS build',
      text: 'The site is built once, at image build time, not on every node.',
      prov: ['inference'],
    },
    {
      id: 'nginx',
      lines: 'FROM nginx:1.27-alpine',
      text: `The last image is nginx and a folder of files. It listens on \`0.0.0.0\` port ${knownImage('nginx')?.defaultPort ?? 'unknown'} by default, so \`containerPorts\` is that port.`,
      prov: ['inference'],
    },
    {
      id: 'size',
      lines: 'COPY --from=build',
      text: 'Only the built files are copied. The image is the nginx base plus your files, usually far smaller than a runtime image, so the install on each node is quick.',
      prov: ['inference'],
    },
    {
      id: 'instances',
      lines: 'instances: 2',
      text: 'A static site has no state, so a second instance costs only its share of the bundle and removes the single point of failure.',
      prov: ['source'],
    },
  ];
}

// ---------------------------------------------------------------------------
// What goes wrong
// ---------------------------------------------------------------------------

/** FACTS 11 rows 4, 5, 6, 7, 18, 19, 20, 21, 31. */
export function buildDockerTrouble(): TroubleRow[] {
  const bytes = LIMITS.repotag.maxImageBytes;
  return [
    {
      id: 'architecture',
      symptom:
        'The app registers but never reaches the number of instances you asked for. An enterprise app is refused. ("Docker image: <image> does not have a valid architecture" is for an image with neither amd64 nor arm64, and another message is for components that share none.)',
      cause: `The image is arm64 only, often built on an Apple silicon Mac. Almost every node is amd64, and only ${SNAPSHOT.arm64Nodes} nodes were arm64 on ${CHECKED.date}, none of them on ArcaneOS.`,
      fix: 'Build with `--platform linux/amd64`, or for both. Enterprise apps need amd64 for every component.',
      lint: ['ENTERPRISE_AMD64'],
      prov: ['source', 'live'],
    },
    {
      id: 'size',
      symptom: '"Docker image: <image> size is over Flux limit".',
      cause: `The compressed layers add up to more than ${gbText(bytes)}.`,
      fix: 'Slim the image, build in stages, and move data to a volume or download it at start.',
      lint: ['IMAGE_MAYBE_HUGE'],
      prov: ['source'],
    },
    {
      id: 'private',
      symptom: '"Private repositories are only allowed for Enterprise Applications".',
      cause: '`repoauth` is set on an app that is not enterprise.',
      fix: 'Make the app enterprise, or use a public image.',
      lint: ['REPOAUTH_NEEDS_ENTERPRISE', 'REPOAUTH_FORMAT'],
      prov: ['source'],
    },
    {
      id: 'blocklist',
      symptom: 'Validation or install is refused with a policy reason.',
      cause: 'The signed network blocklist matches the app name, owner, image or registry namespace.',
      fix: 'Use another image or namespace. The blocklist is public.',
      lint: [],
      prov: ['source'],
    },
    {
      id: 'latest',
      symptom: 'Different instances behave differently, or behaviour changes with no update.',
      cause: `The tag moved. FluxOS is set to recheck the registry about every ${NODE.imageCheckHours} hours and redeploy a changed image (read from the source, not observed live).`,
      fix: 'Pin a version tag that never moves and update it on purpose.',
      lint: ['IMAGE_LATEST', 'IMAGE_UNTAGGED'],
      prov: ['source', 'unverified'],
    },
    {
      id: 'unhealthy',
      symptom: 'A container is stuck but not replaced.',
      cause:
        'Flux ignores `HEALTHCHECK` and the restart policy is `no`. A running container counts as healthy.',
      fix: 'Make the process exit when it is broken, and run more instances.',
      lint: ['HEALTH_NOT_CHECKED'],
      prov: ['source'],
    },
    {
      id: 'crash-loop',
      symptom: 'The instance keeps restarting, and the restarts get further apart.',
      cause: 'The container exits at start: a missing variable, bad `commands` or a port clash.',
      fix: "Read the Logs tab, fix the cause and redeploy. Remember that `commands` replaces the image's CMD arguments and is not a shell line.",
      lint: ['COMMAND_UNSPLIT'],
      prov: ['source'],
    },
    {
      id: 'permission',
      symptom: 'The app cannot write to its data folder: "permission denied".',
      cause: 'The image runs as a non-root user and the volume root is owned by someone else.',
      fix: 'Run as root, or `chown` the folder in the entrypoint before starting the process.',
      lint: [],
      prov: ['source', 'unverified'],
    },
    {
      id: 'full',
      symptom: '"No space left on device".',
      cause: '`hdd` is a fixed size volume shared by every mount of the component, and it is full.',
      fix: 'Free space or update with more `hdd`. A larger volume redeploys the app from scratch, so back up first.',
      lint: ['DISK_SMALL_STATEFUL'],
      prov: ['source'],
    },
    {
      id: 'secrets',
      symptom: 'A password can be read at `/apps/appspecifications/<name>`.',
      cause: 'Environment variables and commands of a public app are public.',
      fix: 'Make the app enterprise, or keep the secret out of the spec.',
      lint: ['ENV_SECRET_PUBLIC'],
      prov: ['docs', 'live'],
    },
  ];
}
