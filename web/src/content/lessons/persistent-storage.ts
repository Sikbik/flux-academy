/**
 * Stratus 3: Persistent storage.
 *
 * Arc: a volume is one file on one node; a plain path dies with its node; r: copies the folder to every
 * instance; g: runs one primary and keeps standbys; space, backups and the hard redeploy.
 *
 * Facts: FACTS 7.1 to 7.4 (grammar, guarantees, mechanics, backups), 6.4 (FDM routes g: apps to the
 * primary), 9.4.2 and 9.4.3 (FluxCloud strings), 9.6 (Control, Backup and Restore and Instances tabs),
 * 11 rows 14 to 17. Guidance, not Flux guarantees: that a single writer database should sit on `g:` and
 * not on `r:` (FACTS 11 rows 14 and 15 mark it as design inference). `s:` is deliberately not taught:
 * FACTS 7.1 and 7.2 mark its semantics UNVERIFIED.
 */

import { FDM_FAILOVER, G_STANDBY_WAIT_MIN_PER_POSITION, LOCATION_TTL_MIN } from '@shared/flux';
import type { Lesson } from '@/learn/types';

/** A photo sharing app that keeps uploads in /data. Every field is spelled out. */
const photos = {
  name: 'photos',
  description: 'Photo sharing',
  repotag: 'acme/photoshare:2.0.1',
  repoauth: '',
  ports: [31500],
  containerPorts: [8080],
  domains: [''],
  environmentParameters: [],
  commands: [],
  containerData: '/data',
  cpu: 0.5,
  ram: 500,
  hdd: 10,
};

const lesson: Lesson = {
  id: 'persistent-storage',
  hook: 'A container is disposable, and the node under it can disappear. You will kill the node that holds the data, see exactly what survives under each storage prefix, and learn why growing a disk can erase it.',
  objectives: [
    'Say what a plain path, `r:` and `g:` each keep when a container restarts, when a node is lost and when the app is redeployed.',
    'Choose the prefix and the number of instances for an app that must keep its data.',
    'Explain why a full volume and a structure change both call for a backup first.',
  ],
  steps: [
    {
      id: 'volume-is-a-file',
      title: 'A volume is a file',
      body: [
        'A container keeps no promises about its own filesystem: when the container is recreated, for example by an update, everything written outside a volume is gone. Data worth keeping goes in a volume, and you ask for one with {{term:container-data}}, a path inside the container. If nothing should be kept, the field still needs a value, and `/tmp` is the usual one. It is still a plain volume, like any other path.',
        'On Flux a volume is a file. The `hdd` gigabytes are set aside up front as one ext4 image on one node, and that image is mounted at your path. A path with no prefix is exactly that: one volume, on one node, for one instance. The prefixes `r:` and `g:` decide what else happens to the file.',
      ],
      // fact: FACTS 7.1 (grammar; /tmp when no data is wanted) and 7.3 (hdd is a pre-allocated ext4 image on one node)
      stage: { kind: 'diagram', id: 'volume-prefixes', beat: 0 },
    },
    {
      id: 'plain-volume',
      title: 'What a plain path survives',
      body: [
        // fact: FACTS 7.2 (plain: survives restart, not node loss; each instance has independent data, instances diverge)
        'A plain volume survives a container restart and a soft redeploy, because the file stays on its node. It does not survive losing the node: the replacement starts on another node with a new, empty volume. And every instance has a volume of its own, so three instances hold three sets of data that never meet.',
        // fact: FACTS 7.2 and 7.3 (the volume is a file on one node; the replacement starts empty on another), 6.3 (a replacement waits for the location record to lapse, up to 125 minutes)
        `Take one node offline and wait for its replacement. It starts on another node and the figure tags it \`EMPTY DISK\`: the old volume was a file on the lost node, and the replacement mounts a fresh one. The simulator compresses the wait into a short pause; on the real network a replacement can take about two hours after the node dies (${LOCATION_TTL_MIN} minutes plus the image pull). In the figure the copies sit on different continents so you can tell them apart, which the network does not promise.`,
      ],
      callouts: [
        {
          // fact: FACTS 7.2 note (docs call plain volumes non-persistent; destroyed by Remove, Hard Reinstall, expiry and cancel)
          kind: 'gotcha',
          body: "FluxCloud's docs call plain volumes 'non-persistent'. That undersells them: the data survives restarts and soft redeploys. It is destroyed by a hard reinstall, by removing the app, by expiry and by cancelling.",
        },
      ],
      stage: {
        kind: 'diorama',
        scene: 'failover',
        instances: 3,
        // A plain path: the figure names the model and tags a replacement that started on an empty disk.
        volume: 'local',
        controls: ['kill', 'revive'],
        annotate: ['instances', 'down', 'lost-data'],
      },
      task: {
        kind: 'kill-nodes',
        count: 1,
        prompt: 'Take one node offline, then wait for its replacement to start with an empty disk.',
      },
    },
    {
      id: 'replicated',
      title: 'r: copies the folder to every instance',
      body: [
        // fact: FACTS 7.2 (r: every instance active, eventually consistent, conflicts possible), 9.4.3 (min 2 instances with synced volumes)
        'Put `r:` in front of the path and {{term:syncthing}} keeps the folder in step across every instance. All instances run and all of them can write. Lose a node and the files survive as long as another instance holds a current copy, so a replacement can start from it; a write that had not synced yet is lost with its node. The price is {{term:eventual-consistency}}: a write on one instance reaches the others after a delay, and two instances writing the same file at once can conflict.',
        'This is file replication, not a database cluster. It suits uploads and shared assets. A copy needs somewhere to go, so FluxCloud asks for at least 2 instances once a volume is synced. Replicate this photo app and give the copies a home.',
      ],
      callouts: [
        {
          // fact: FACTS 9.4.2 (Simple mode: "Keep it safe across node failures" writes r:<path> and forces at least 2 copies)
          kind: 'tip',
          body: "FluxCloud's simple form has a switch called 'Keep it safe across node failures'. It writes `r:` in front of your folder and raises the copies to at least 2.",
        },
        {
          // fact: FACTS 7.1 and 7.2 (s: semantics UNVERIFIED), lint CONTAINER_DATA_SYNC_FLAGS
          kind: 'gotcha',
          body: 'Live specs also use `s:`. The docs describe only `r:` and `g:`, and what `s:` does is inferred from code, not documented, so this course does not teach it.',
        },
      ],
      stage: {
        kind: 'spec',
        spec: {
          name: 'photoshare',
          description: 'Photo sharing',
          instances: 1,
          compose: [photos],
        },
        editable: ['compose[0].containerData', 'instances'],
        focus: [
          {
            path: 'compose[0].containerData',
            note: 'A plain path today. Put `r:` in front, keeping the path.',
          },
          { path: 'instances', note: 'A replicated volume has nowhere to copy to with one instance.' },
        ],
        show: ['form', 'json', 'issues'],
      },
      task: {
        kind: 'spec',
        prompt: 'Make `/data` a replicated volume and run at least two instances.',
        hint: 'The prefix goes in front of the path and the path stays as it is. The issues panel tells you when a synced volume has nobody to sync with.',
        check: {
          all: [
            {
              path: 'compose[0].containerData',
              op: 'matches',
              value: '^r:/data$',
              message: 'Put the prefix `r:` in front of `/data`.',
            },
            {
              path: 'instances',
              op: 'gte',
              value: 2,
              message: 'A replicated volume needs at least 2 instances.',
            },
          ],
        },
        solution: { instances: 2, compose: [{ containerData: 'r:/data' }] },
      },
    },
    {
      id: 'primary-standby',
      title: 'g: runs one copy at a time',
      body: [
        // fact: FACTS 7.2 and 6.4 (g: single writer; only the elected primary runs the g: component, other components keep running; FDM sends every port to the primary node and lists one server; 3 failed checks and 90 s, election every 30 s, a standby waits about 3 minutes per place), 9.6 (Instances tab string)
        'Some software must have exactly one writer: a database engine, a game server. {{term:primary-standby}} is for that, written `g:`. Every instance still holds a synced copy of the folder, but only the elected primary runs that component, and the load balancer sends every port of the app to the primary node alone. The others wait as standbys.',
        `Kill the primary. A standby is elected and started, and until it is running there is no primary at all. On the real network that gap is minutes, not seconds: the load balancer moves away only after at least ${FDM_FAILOVER.minFailedChecks} failed checks and ${FDM_FAILOVER.minUnhealthySec} seconds, and a standby can wait about ${G_STANDBY_WAIT_MIN_PER_POSITION} minutes per place in the order. FluxCloud's Instances tab shows 'Defining New Primary In Progress' while it lasts. The simulator compresses the wait, and shows the copies on different continents only so you can tell them apart.`,
      ],
      callouts: [
        {
          kind: 'why',
          body: 'Plan for the gap: the app is down while a new primary is elected. `g:` gives you your data back as far as the last sync reached the standby, so the newest writes may be missing, and it does not give you zero downtime.',
        },
      ],
      stage: {
        kind: 'diorama',
        scene: 'sync',
        instances: 3,
        controls: ['kill', 'revive'],
      },
      task: {
        kind: 'kill-nodes',
        count: 1,
        prompt: 'Kill the primary and watch a standby take over.',
      },
    },
    {
      id: 'space-and-backups',
      title: 'Full disks, hard redeploys and backups',
      body: [
        // fact: FACTS 7.3 and 11 rows 16 and 17 (hdd is fixed; ENOSPC; more hdd needs a hard redeploy; structure changes escalate)
        'The `hdd` value is the size of the file, fixed when the volume is created. When it fills, writes fail with {{term:enospc}}: No space left on device. The fix is a bigger `hdd`, and that is an update that recreates the volume, a hard redeploy, which starts empty. Changing the structure of a spec, such as renaming or reordering components, escalates a soft redeploy to a hard one in the same way.',
        // fact: FACTS 7.4 (a local backup is a file inside the component's own volume, not replicated, lost with the node and the volume, counts against hdd; the UI's automatic weekly sentence is not backed by a scheduler in the source read) and 9.6 (UI text)
        'So take a backup before you grow a volume or restructure an app, and do not wait for an automatic one: the Backup and Restore tab says weekly backups are created while the app is active, but no weekly scheduler was found in the node source read for this course.',
        "A local backup is a file inside the component's own volume. It is not replicated, it counts against `hdd`, and it is lost with the node and with the app. Download one, or upload it to FluxDrive, to keep a copy outside the app before you cancel or let the app expire.",
      ],
      callouts: [
        {
          // fact: FACTS 9.6 (FluxDrive free backups up to 10 GB per user; UI string)
          kind: 'tip',
          body: "The Backup and Restore tab can upload a backup to FluxDrive, and FluxCloud's text says the first 10 GB per user are free.",
        },
      ],
      stage: {
        kind: 'compare',
        left: {
          label: 'Soft redeploy',
          tone: 'good',
          body: "FluxCloud's words: it 'will redeploy the application while keeping existing data.' The containers are recreated and the volume stays.",
        },
        right: {
          label: 'Hard redeploy',
          tone: 'bad',
          body: "FluxCloud's words: it 'will completely remove and redeploy the application. All application data will be deleted.' A bigger `hdd` or a changed structure causes one.",
        },
      },
    },
  ],
  checkpoint: [
    {
      id: 'dashboards-keep-nothing',
      kind: 'spec-fix',
      prompt:
        'A team runs Grafana for its dashboards. After a node was replaced the dashboards were gone. Fix the spec so the data is kept and a standby exists.',
      spec: {
        name: 'dashboards',
        description: 'Team dashboards',
        instances: 1,
        compose: [
          {
            name: 'grafana',
            description: 'Dashboards',
            repotag: 'grafana/grafana:11.2.0',
            repoauth: '',
            ports: [31300],
            containerPorts: [3000],
            domains: [''],
            environmentParameters: [],
            commands: [],
            containerData: '/tmp',
            cpu: 0.5,
            ram: 500,
            hdd: 5,
          },
        ],
      },
      check: {
        all: [
          {
            path: 'compose[0].containerData',
            op: 'matches',
            value: '^g:/var/lib/grafana$',
            message: 'Mount the folder Grafana keeps its data in, with the g: prefix.',
          },
          { path: 'instances', op: 'gte', value: 2, message: 'A standby needs a second instance.' },
          {
            lint: 'absent',
            codes: ['STATEFUL_NO_VOLUME', 'STATEFUL_NOT_SYNCED', 'SYNC_SINGLE_INSTANCE'],
          },
        ],
      },
      solution: { instances: 2, compose: [{ containerData: 'g:/var/lib/grafana' }] },
      explain:
        'Grafana keeps its dashboards and users under /var/lib/grafana, so that is the folder to mount: with /tmp mounted, the dashboards were written outside any volume. A plain volume would still have vanished with its node. One writer with a standby, g:, plus at least two instances, gives the data a second home.',
      hint: "The issues panel names two problems: the volume is not where the image keeps its data, and it is not synced. Grafana's data folder is /var/lib/grafana.",
    },
    {
      id: 'durability-order',
      kind: 'order',
      prompt: 'Put these from least to most durable.',
      items: [
        { id: 'container', label: "Files written to the container's own filesystem, outside any volume" },
        { id: 'plain', label: 'A plain volume on one node' },
        { id: 'synced', label: 'A synced volume (`r:` or `g:`) with several instances' },
        { id: 'backup', label: 'A backup you downloaded and stored somewhere else' },
      ],
      explain:
        'Container files go when the container is recreated. A plain volume survives that but not its node. A synced volume survives the loss of a node while another instance holds a current copy, but a hard redeploy of every instance, removal or expiry still ends it. A copy you hold outside the app outlives all of those.',
      hint: 'Ask what each one survives: a container being recreated, a node being lost, the whole app being removed.',
    },
    {
      id: 'prefix-for-engine',
      kind: 'choice',
      prompt: 'Which volume would you give a database engine that must have exactly one writer?',
      options: [
        {
          id: 'g',
          label: '`g:` on at least two instances, so a standby holds a synced copy',
        },
        {
          id: 'plain',
          label: 'A plain path on three instances',
          why: 'Each instance would keep its own separate copy, and a lost node takes its copy with it.',
        },
        {
          id: 'r',
          label: '`r:` on three instances, so every instance can write',
          why: 'That lets several instances write the same files. Flux replicates files; it does not coordinate a database engine, so the usual guidance is one writer.',
        },
        {
          id: 'tmp',
          label: '`/tmp`, because the engine rebuilds its data on start',
          why: "A database engine does not rebuild its data on start, and its data folder is not /tmp. Its files would sit in the container's own filesystem and vanish when the container is recreated.",
        },
      ],
      answer: 'g',
      explain:
        'The guidance for a single-writer engine is `g:`: one elected primary writes, standbys hold copies, and the load balancer sends traffic only to the primary node. It is guidance, not a guarantee, so test the failover you rely on.',
      hint: 'The engine wants one writer and the data has to survive its node. Which prefix keeps exactly one copy running?',
    },
    {
      id: 'prefix-meanings',
      kind: 'match',
      prompt: 'Match each containerData value to what it gives you.',
      pairs: [
        {
          id: 'plain',
          left: '`/data`',
          right: 'One volume on one node, separate for each instance, lost with its node',
        },
        {
          id: 'r',
          left: '`r:/data`',
          right: 'Every instance runs and writes, and the copies converge over time',
        },
        { id: 'g', left: '`g:/data`', right: 'One elected primary runs and the standbys keep a synced copy' },
        {
          id: 'tmp',
          left: '`/tmp`',
          right: 'The usual value when there is nothing to keep, still a plain volume',
        },
      ],
      explain:
        'The prefix is the whole difference: none keeps a file on one node, `r:` replicates it between running instances and `g:` runs one instance at a time.',
      hint: 'Think about who runs and who writes: every instance, one elected instance, or each instance alone.',
    },
  ],
  recap: [
    'A volume is one pre-allocated file on one node. A plain path survives restarts and soft redeploys, not the loss of its node.',
    '`r:` replicates the folder to every instance and every instance writes, so copies converge over time and can conflict. A node loss is survived while another instance holds a current copy. It is file replication, not a database cluster.',
    '`g:` keeps one elected primary running with synced standbys. Re-election takes a delay of minutes, the app is down meanwhile, and the newest writes may be missing.',
    'Synced volumes need at least 2 instances to have anywhere to copy to.',
    'A fuller disk and a restructured spec both lead to a hard redeploy. Back up first, and keep a copy outside the app.',
  ],
  further: [
    {
      label: 'FluxCloud docs: components and the container data path',
      url: 'https://docs.runonflux.com/fluxcloud/register-new-app/deploy-with-docker/components',
    },
    {
      label: 'FluxCloud docs: backup and restore',
      url: 'https://docs.runonflux.com/fluxcloud/applications/management/manage-app/backup-and-restore',
    },
  ],
  terms: ['container-data', 'syncthing', 'primary-standby', 'eventual-consistency', 'enospc'],
};

export default lesson;
