/**
 * Stage 7: data and updates. What survives a restart, a node loss, an update and an expiry.
 *
 * Source of truth is FACTS section 7 (persistence) and the update rules in 4.5 and 9.5.4. The advice on
 * `r:` versus `g:` is design guidance and FACTS labels it unverified; the causes say so.
 */

import { api, docs, fix, fixForge, fixJson, forge, look, PREFIX_ADVICE, src } from './build';
import type { Symptom } from './types';

export const DATA_SYMPTOMS: Symptom[] = [
  {
    id: 'data-gone-after-update',
    stage: 'data',
    title: 'My data is gone after an update',
    summary: 'The app came back from an update with an empty volume.',
    seen: [
      'This update will trigger a hard redeploy',
      'Resource requirements increased',
      'The volume is empty after the update',
    ],
    keywords: [
      'data lost',
      'update deleted data',
      'hard redeploy',
      'hard reinstall',
      'soft redeploy',
      'volume empty',
      'lost files',
      'database empty',
      'rename component',
    ],
    quick:
      'Some updates recreate the volume: a version upgrade, adding, removing or renaming a component, a change of disk size, or an app that has to move to a bigger node. Create a backup and download it before any of them.',
    causes: [
      {
        id: 'hard-redeploy',
        title: 'The update escalated to a hard redeploy',
        why: 'A soft redeploy keeps volume data. A structural change to a version 8 spec escalates it to a hard redeploy, which recreates the volume from scratch. The review step warns "This update will trigger a hard redeploy".',
        likelihood: 'usual',
        checks: [
          look(
            'Read the warnings at the top of Review and Validate before you sign. They name what triggers it.',
          ),
          api('appspec', 'Compare `compose[].name` and `hdd` with what you had before the update.'),
        ],
        fixes: [
          fix(
            'Before any change that can trigger it, open Backup & Restore, create a backup and download it. After the update restore it into the new volume.',
          ),
          fix('Avoid renaming or reordering components, and avoid changing disk size without a backup.'),
        ],
        proof: src('11 row 17; 7.3; 9.5.4'),
        lessons: ['operate-your-app', 'persistent-storage'],
        terms: ['hard-redeploy', 'soft-redeploy'],
      },
      {
        id: 'moved-to-bigger-node',
        title: 'The new spec did not fit its nodes, so the app moved',
        why: 'When the larger spec cannot be held by the nodes that run it, the app is reinstalled elsewhere and data on the old nodes is lost. The review step shows "Resource requirements increased".',
        likelihood: 'common',
        checks: [look('Look for the Resource requirements increased message on the review step.')],
        fixes: [
          fix(
            'Download a backup first. A synced volume (`g:` or `r:`) keeps a copy on more than one node and survives the loss of a node as long as a current copy remains.',
            { proof: PREFIX_ADVICE },
          ),
        ],
        proof: src('9.5.4'),
        lessons: ['persistent-storage', 'resources-pricing'],
        terms: ['container-data', 'primary-standby'],
      },
      {
        id: 'not-on-volume',
        title: 'The data was never on the volume',
        why: 'Only the path in `containerData` is a volume. Anything the app writes elsewhere lives in the container layer and disappears when the container is recreated. A plain path, `/tmp` included, is a volume on one node only: it survives a restart and is lost with the node and on a hard redeploy. The FluxCloud docs call plain volumes non-persistent, which is misleading: the data stays on that node. `/tmp` is only the wording the validator uses for a spec with no data folder, so treat it as scratch space.',
        likelihood: 'common',
        checks: [
          forge('See the lint for a database with no data path', {
            fixture: 'wordpress-mysql',
            patch: { compose: [{ containerData: '/tmp' }, { containerData: '/tmp' }] },
            shows: ['STATEFUL_NO_VOLUME'],
          }),
        ],
        fixes: [
          fixJson(
            'Point `containerData` at the folder the app really writes. A `g:` or `r:` prefix needs at least two instances in FluxCloud.',
            '"containerData": "g:/var/lib/mysql"',
            undefined,
            PREFIX_ADVICE,
          ),
        ],
        proof: src('7.1; 7.3'),
        lint: ['STATEFUL_NO_VOLUME', 'STATEFUL_NOT_SYNCED'],
        lessons: ['persistent-storage'],
        terms: ['container-data'],
      },
      {
        id: 'hard-reinstall-clicked',
        title: 'Someone used Hard Reinstall',
        why: 'The Control tab has Soft Reinstall, which keeps data, and Hard Reinstall, which removes the app, redeploys it and deletes all of its data.',
        likelihood: 'possible',
        checks: [look('Ask whoever has the login whether they used Hard Reinstall on the Control tab.')],
        fixes: [
          fix('Use Soft Reinstall for a restart that keeps data. Restore from a backup if you have one.'),
        ],
        proof: src('9.6'),
        lessons: ['operate-your-app'],
        terms: ['soft-redeploy', 'hard-redeploy'],
      },
    ],
    lessons: ['operate-your-app', 'persistent-storage'],
    labs: ['failover'],
    related: ['recover-lost-data', 'data-differs-or-missing', 'volume-full'],
    lint: ['STATEFUL_NO_VOLUME'],
  },

  {
    id: 'data-differs-or-missing',
    stage: 'data',
    title: 'Data is missing, or each instance has different data',
    summary: 'After a node change the app starts empty, or two instances show different content.',
    seen: ['Empty after a node change', 'Instances disagree', 'Uploaded files only on one instance'],
    keywords: [
      'data missing',
      'different data',
      'each instance',
      'not synced',
      'replicated',
      'syncthing',
      'plain volume',
      'node changed',
      'files differ',
      'sync',
    ],
    quick:
      'A plain `containerData` path is a volume on one node. It survives a restart and a soft redeploy, and is lost with the node. Instances of a plain volume never share data.',
    causes: [
      {
        id: 'plain-volume',
        title: 'The volume is plain, so it lives on one node',
        why: 'With no prefix the data is one ext4 volume image on that node. A replacement instance on another node starts empty, and several instances each keep their own copy that diverges.',
        likelihood: 'usual',
        checks: [look('Read `containerData`. No `r:`, `g:` or `s:` before the path means a plain volume.')],
        fixes: [
          fixJson(
            'Use `g:` for a database or any single writer, with at least two instances, and `r:` only for data that tolerates conflicts.',
            '"containerData": "g:/var/lib/postgresql/data"',
            undefined,
            PREFIX_ADVICE,
          ),
        ],
        proof: src('11 row 14; 7.2'),
        lint: ['STATEFUL_NOT_SYNCED', 'STATEFUL_NO_VOLUME'],
        lessons: ['persistent-storage'],
        terms: ['container-data', 'primary-standby', 'syncthing'],
      },
      {
        id: 'new-replica-syncing',
        title: 'A new replica is still copying',
        why: 'On an `r:` volume the first instance leads and later ones start receive-only. They must sync to 100 percent before they serve, and a large volume takes time. What `s:` does is not documented, so this page leaves it out.',
        likelihood: 'common',
        checks: [
          look(
            'No screen that we verified shows sync progress. The larger the volume, the longer a new instance takes before it serves, so compare how long it has been with how much data the volume holds.',
          ),
        ],
        fixes: [
          fix(
            'Wait for the sync to complete. A very large volume is a reason to keep fewer, longer lived replicas.',
          ),
        ],
        proof: src(
          '7.2; 7.3',
          'The 100 percent rule is read in source. We found no screen that shows sync progress.',
        ),
        lessons: ['persistent-storage'],
        terms: ['syncthing', 'eventual-consistency'],
      },
      {
        id: 'r-conflicts',
        title: 'Two instances wrote the same file on an r: volume',
        why: 'An `r:` volume is replicated by file sync and is eventually consistent. Every instance writes, so conflicting changes are possible and the content can differ between instances for a while.',
        likelihood: 'possible',
        checks: [
          look(
            'Compare the same file on two instances at different times. Content that differs for a while and then settles is replication catching up.',
          ),
        ],
        fixes: [
          fix('Let one instance write (use `g:`), or design the data so writers never touch the same file.', {
            proof: PREFIX_ADVICE,
          }),
        ],
        proof: src('7.2; 11 row 15'),
        lint: ['DB_ON_REPLICATED_MOUNT'],
        lessons: ['persistent-storage'],
        terms: ['eventual-consistency'],
      },
      {
        id: 'outside-mount',
        title: 'The files are written outside the mounted folder',
        why: 'Only the mounted path is persistent and replicated. The rest is the container filesystem, which is not part of `hdd`, is not replicated, and is capped at 10 GB on nodes whose Docker uses XFS with project quota.',
        likelihood: 'possible',
        checks: [
          look('Compare the folder your app writes with the path after the colon in `containerData`.'),
        ],
        fixes: [
          fixForge('Open a spec with a data path and compare.', 'Open the forge', { fixture: 'minecraft' }),
        ],
        proof: src('7.3'),
        lessons: ['persistent-storage'],
      },
    ],
    lessons: ['persistent-storage', 'shared-database'],
    labs: ['failover'],
    related: ['database-corrupt-failover', 'single-instance-down'],
    lint: ['STATEFUL_NOT_SYNCED'],
  },

  {
    id: 'database-corrupt-failover',
    stage: 'data',
    title: 'My database is corrupt or inconsistent after a failover',
    summary: 'Tables are damaged, or two copies of the database disagree after an instance changed.',
    seen: ['Corrupt database files', 'Conflicting writes after failover', 'Defining New Primary In Progress'],
    keywords: [
      'database corrupt',
      'corruption',
      'r: database',
      'replicated database',
      'mysql',
      'postgres',
      'mongodb',
      'primary standby',
      'election',
      'split brain',
    ],
    quick:
      'File replication is not a database cluster. Our judgement, which is not verified: run a single-writer database on `g:` (one primary, standbys hold a copy), or run a real clustered database.',
    causes: [
      {
        id: 'db-on-r',
        title: 'A single-writer database runs on an r: volume with several writers',
        why: '`r:` runs every instance writing and replicates the files, which is file replication and not a database cluster. A database that expects to own its files alone, such as MySQL or PostgreSQL, can be left with corrupt or conflicting files.',
        likelihood: 'usual',
        checks: [
          forge('See the lint for a database on an r: mount', {
            fixture: 'three-tier',
            patch: { compose: [{}, {}, { containerData: 'r:/var/lib/postgresql/data' }] },
            shows: ['DB_ON_REPLICATED_MOUNT'],
          }),
        ],
        fixes: [
          fixJson(
            'Use a primary and standby mount (`g:`) for it.',
            '"containerData": "g:/var/lib/postgresql/data"',
            undefined,
            PREFIX_ADVICE,
          ),
          fix('Or run a database that is a cluster by design.'),
        ],
        proof: src(
          '11 row 15; 7.2',
          'How r: behaves is read in source. That a database is damaged by it is an inference (FACTS 11 row 15, guidance UNVERIFIED).',
        ),
        lint: ['DB_ON_REPLICATED_MOUNT'],
        lessons: ['persistent-storage', 'shared-database'],
        terms: ['primary-standby', 'eventual-consistency', 'syncthing'],
      },
      {
        id: 'election-delay',
        title: 'The primary was being replaced',
        why: 'When the primary dies, a standby is elected after a delay of minutes, and the load balancer routes only to the elected primary. Writes in that gap fail or are retried.',
        likelihood: 'common',
        checks: [look('The Instances tab shows "Defining New Primary In Progress" while it happens.')],
        fixes: [
          fix('Make the app retry its database connection with a back-off, and expect a delay of minutes.'),
        ],
        proof: src('7.2; 6.4'),
        lessons: ['shared-database', 'persistent-storage'],
        terms: ['primary-standby', 'failover'],
      },
      {
        id: 'single-primary-no-standby',
        title: 'There is no standby to take over',
        why: 'A `g:` volume with one instance has no second copy. A standby needs at least two instances.',
        likelihood: 'possible',
        checks: [api('location', 'Count the rows: one row means no standby.')],
        fixes: [fix('Set `instances` to 2 or more.')],
        proof: src('7.2; 6.5'),
        lint: ['SYNC_SINGLE_INSTANCE', 'STATEFUL_SINGLE_INSTANCE'],
        lessons: ['shared-database'],
      },
    ],
    lessons: ['persistent-storage', 'shared-database'],
    labs: ['failover'],
    related: ['data-differs-or-missing'],
    lint: ['DB_ON_REPLICATED_MOUNT'],
  },

  {
    id: 'volume-full',
    stage: 'data',
    title: 'No space left on device',
    summary: 'The app fails writing files and the log says the device is full.',
    seen: ['No space left on device', 'ENOSPC'],
    keywords: [
      'no space left',
      'disk full',
      'enospc',
      'volume full',
      'hdd',
      'out of disk',
      'storage full',
      'increase disk',
    ],
    quick:
      'The `hdd` value is a fixed-size volume shared by every mount of the component. Growing it is an update that recreates the volume, so back up first.',
    causes: [
      {
        id: 'volume-limit',
        title: 'The volume reached its size',
        why: 'The volume is a pre-allocated ext4 image of `hdd` gigabytes. When it is full writes fail with ENOSPC, and all mounts of that component share the same space.',
        likelihood: 'usual',
        checks: [
          look(
            'Open Manage, then Secure Shell, then the Volume Browser. It shows used and allocated gigabytes.',
          ),
        ],
        fixes: [
          fix(
            'Create a backup and download it, then update with a larger `hdd`. Changing disk size triggers a hard redeploy, so restore the backup afterwards. A larger `hdd` also raises the price, and if the current nodes cannot hold it the app is reinstalled elsewhere.',
          ),
        ],
        proof: src('11 row 16; 7.3; 9.5.4'),
        lessons: ['persistent-storage'],
        terms: ['enospc', 'container-data', 'hard-redeploy'],
      },
      {
        id: 'container-layer',
        title: 'Writes go to the container layer, not the volume',
        why: 'The container filesystem is separate from the volume and is capped (10 GB on nodes that enforce a project quota). Logs or temporary files written there fill it.',
        likelihood: 'possible',
        checks: [
          look('Check where the biggest files are: the mounted folder or elsewhere in the container.'),
        ],
        fixes: [fix('Write caches, uploads and logs under the mounted folder, or clean them regularly.')],
        proof: src('7.3', 'The cap depends on the node.'),
        lessons: ['persistent-storage'],
      },
      {
        id: 'log-growth',
        title: 'Application logs grew without bound',
        why: 'Docker keeps container logs in four files of about 20 MB in total, so those are not the problem. Log files the app itself writes to the volume are.',
        likelihood: 'possible',
        checks: [look('Look in the volume browser for a log folder that is gigabytes in size.')],
        fixes: [fix('Rotate or trim the app log files, or log to standard output.')],
        proof: src('7.3'),
        lessons: ['persistent-storage', 'production-checklist'],
      },
    ],
    lessons: ['persistent-storage'],
    related: ['data-gone-after-update', 'permission-denied-volume'],
  },

  {
    id: 'recover-lost-data',
    stage: 'data',
    title: 'Can I recover data I have lost?',
    summary: 'Files or a database were lost after a failure, an update, an expiry or a removal.',
    seen: ['Backup & Restore', 'Available Local Backups', 'Restore from FluxDrive'],
    keywords: [
      'recover',
      'restore',
      'backup',
      'lost data',
      'fluxdrive',
      'download backup',
      'restore backup',
      'weekly backup',
    ],
    quick:
      'Only a backup brings data back, and backups are deleted with the app. Check Backup & Restore first. Its text says automatic weekly backups are made while the app is active, but the source that was read has no weekly scheduler and the docs say only manual ones exist, so look at the list, create one by hand and download the one you need.',
    causes: [
      {
        id: 'backup-exists',
        title: 'A backup exists on the app',
        why: 'The Backup & Restore tab says automatic weekly backups are created and kept while the app is active, but no weekly scheduler was found in the source that was read, so do not rely on one. You can create one by hand, and the FluxDrive upload offers up to 10 GB free per user.',
        likelihood: 'usual',
        checks: [
          look(
            'Manage, then Backup & Restore, then Available Local Backups. Note the component, date and size.',
          ),
        ],
        fixes: [
          fix(
            'Restore from FluxDrive, an uploaded file or a remote URL ending in .tar.gz. Restore overwrites the current state, so download the current data first if it matters. A local backup sits inside the component volume on the node and is not replicated to other instances, so it is lost with the node and counts against the disk size. Download the ones that matter.',
          ),
        ],
        proof: src(
          '7.4; 9.6',
          'The screen says weekly and the docs page says only manual backups exist. The source read has no weekly scheduler, so treat the weekly sentence as unverified.',
        ),
        lessons: ['operate-your-app', 'persistent-storage'],
      },
      {
        id: 'app-removed',
        title: 'The app expired or was cancelled',
        why: 'Backups are deleted with the app, and an expired or cancelled app is removed together with its data. A new registration starts empty.',
        likelihood: 'common',
        checks: [api('appspec', '`Application: {app} not found` means the app is gone.')],
        fixes: [
          fix('Look for a backup you downloaded earlier. Next time, download one before expiry or cancel.'),
        ],
        proof: docs(
          '7.4; 5.4',
          'The removal of an expired app and its data is read in source (5.4). That its backups go with it is from the docs only.',
        ),
        see: ['app-expired'],
        lessons: ['operate-your-app'],
      },
      {
        id: 'node-lost-plain',
        title: 'The data was on a plain volume of a node that is gone',
        why: 'A plain volume lives on one node only. The network keeps no other copy of it.',
        likelihood: 'possible',
        checks: [look('Check `containerData`: no prefix means plain.')],
        fixes: [
          fix(
            'Use a downloaded backup if there is one. Going forward, use `g:` or `r:` with two or more instances: a synced volume survives the loss of a node as long as a current copy remains, and the newest writes may be missing.',
          ),
        ],
        proof: src('7.2'),
        see: ['data-differs-or-missing'],
        lessons: ['persistent-storage'],
      },
    ],
    lessons: ['operate-your-app', 'persistent-storage'],
    related: ['data-gone-after-update', 'app-expired'],
    caveat: 'We cannot tell whether a given backup is intact. Test a restore before you rely on one.',
  },
];
