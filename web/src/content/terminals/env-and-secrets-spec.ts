/**
 * Terminal script for the env-and-secrets lesson: read the public spec of an app, then the spec of an
 * enterprise app, the way anyone on the internet can.
 *
 * Simulation. The apps are made up. The responses have the real shape of GET /apps/appspecifications/<name>
 * (FACTS 10 E-appspecifications, docs/research/samples/apps_appspecifications_*.json): the spec plus `hash`
 * and `height`. An enterprise (v8) app answers with `compose: []`, `contacts: []` and an `enterprise` blob. The ciphertext is shortened here: its real length depends on the spec.
 */

import { EXAMPLE_OWNER } from '@shared/flux';
import type { TerminalScript } from '@/learn/types';

const NOTES = {
  status: 'success',
  data: {
    version: 8,
    name: 'notes',
    description: 'A small notes API',
    owner: EXAMPLE_OWNER,
    compose: [
      {
        name: 'api',
        description: 'Notes API',
        repotag: 'yourname/notes-api:2.0.0',
        ports: [31001],
        containerPorts: [3000],
        domains: [''],
        environmentParameters: ['DB_HOST=db.internal.example', 'DB_PASSWORD=hunter2', 'LOG_LEVEL=info'],
        commands: [],
        containerData: '/tmp',
        cpu: 0.5,
        ram: 500,
        hdd: 5,
        repoauth: '',
      },
    ],
    instances: 3,
    contacts: [],
    geolocation: [],
    expire: 88000,
    nodes: [],
    staticip: false,
    enterprise: '',
    hash: '3f6a0c1d8e2b94a75c0de1f3a8b6724e90d5c3a1b7f8e26d4c90a5b1e3f7d28c',
    height: 3021877,
  },
};

const VAULT = {
  status: 'success',
  data: {
    version: 8,
    name: 'acme-vault',
    description: 'Internal tools',
    owner: EXAMPLE_OWNER,
    compose: [],
    instances: 3,
    contacts: [],
    geolocation: [],
    expire: 264000,
    nodes: [],
    staticip: false,
    enterprise: '<base64 ciphertext, shortened>',
    hash: '9b2e47d0a1c5f83e6d70b4a29c8e15f3d6a07b92e4c1583fa0d6b7e92c4f1a38',
    height: 2969042,
  },
};

const NOTES_ENV = NOTES.data.compose[0]?.environmentParameters ?? [];

const CURL = '^curl (?:-s |-sS |--silent )?https://api\\.runonflux\\.io/apps/appspecifications/';
const OK_NOTES = `${CURL}notes`;
const OK_VAULT = `${CURL}acme-vault`;

export const envAndSecretsSpec: TerminalScript = {
  id: 'env-and-secrets-spec',
  prompt: '$',
  cwd: '~',
  intro: [
    '[dim] Simulation. The responses have the real shape of the Flux API. The apps are made up and nothing leaves this page.',
    '[dim] Two apps are registered: notes, a public app, and acme-vault, an enterprise app.',
    '[dim] Read a spec the way anyone can: curl -s https://api.runonflux.io/apps/appspecifications/<name>',
  ],
  commands: [
    {
      // fact: FACTS 8.3 and 11 row 18 (the spec of a public app is public, env vars and commands included)
      match: `${OK_NOTES}$`,
      output: [JSON.stringify(NOTES)],
      goal: 'fetch',
      stream: 30,
      explain:
        'No login and no key: the API returns the whole spec of any app that is not enterprise. `environmentParameters` is plain text, and so is everything else in `compose`.',
      example: 'curl -s https://api.runonflux.io/apps/appspecifications/notes',
    },
    {
      match: `${OK_NOTES} \\| jq$`,
      output: JSON.stringify(NOTES, null, 2).split('\n'),
      goal: 'fetch',
      stream: 12,
      explain: 'The same response, pretty printed. Every field of the spec is there, including the password.',
      example: 'curl -s https://api.runonflux.io/apps/appspecifications/notes | jq',
    },
    {
      match: `${OK_NOTES} \\| jq -r '\\.data\\.compose\\[\\]\\.environmentParameters\\[\\]'$`,
      output: NOTES_ENV,
      goal: 'fetch',
      explain: 'One line per variable, exactly as the container receives it. A stranger needs one command.',
      example:
        "curl -s https://api.runonflux.io/apps/appspecifications/notes | jq -r '.data.compose[].environmentParameters[]'",
    },
    {
      match: `${OK_NOTES} \\| jq '\\.data\\.compose\\[0\\]\\.environmentParameters'$`,
      output: JSON.stringify(NOTES_ENV, null, 2).split('\n'),
      goal: 'fetch',
      explain: 'The environment of the first component as a JSON list, password included.',
      example:
        "curl -s https://api.runonflux.io/apps/appspecifications/notes | jq '.data.compose[0].environmentParameters'",
    },
    {
      // fact: FACTS 3.7 and the sample apps_appspecifications_enterprise.json
      match: `${OK_VAULT}$`,
      output: [
        JSON.stringify(VAULT),
        '[dim] (the real value of "enterprise" is a long base64 string, shortened here)',
      ],
      goal: 'sealed',
      stream: 30,
      explain:
        'The public record keeps the shell of the spec. `compose` and `contacts` are empty, and everything about the components sits inside one blob of ciphertext.',
      example: 'curl -s https://api.runonflux.io/apps/appspecifications/acme-vault',
    },
    {
      match: `${OK_VAULT} \\| jq$`,
      output: [
        ...JSON.stringify(VAULT, null, 2).split('\n'),
        '[dim] (the real value of "enterprise" is a long base64 string, shortened here)',
      ],
      goal: 'sealed',
      stream: 12,
      explain:
        'Same call, pretty printed. Ports, images, environment variables and credentials are all inside `enterprise`.',
      example: 'curl -s https://api.runonflux.io/apps/appspecifications/acme-vault | jq',
    },
    {
      match: `${OK_VAULT} \\| jq '\\.data\\.compose'$`,
      output: ['[]'],
      goal: 'sealed',
      explain:
        'There is nothing to list: the components are encrypted, so the public field is an empty array.',
      example: "curl -s https://api.runonflux.io/apps/appspecifications/acme-vault | jq '.data.compose'",
    },
    {
      match: `${OK_VAULT} \\| jq -r '\\.data\\.compose\\[\\]\\.environmentParameters\\[\\]'$`,
      output: ['[dim] No output: compose is empty, so there are no environment variables to list.'],
      goal: 'sealed',
      explain:
        'The same command that printed the notes password prints nothing here. The variables exist, and only the owner and ArcaneOS nodes can read them.',
      example:
        "curl -s https://api.runonflux.io/apps/appspecifications/acme-vault | jq -r '.data.compose[].environmentParameters[]'",
    },
    {
      match: '^curl (?:-s |-sS |--silent )?https://api\\.runonflux\\.io/apps/appspecifications/(\\S+)$',
      output: ['{"status":"error","data":{"name":"Error","message":"Application: {1} not found"}}'],
      explain: 'The endpoint answers by app name. This simulation knows two apps: notes and acme-vault.',
    },
  ],
  goals: [
    { id: 'fetch', label: 'Read the public spec of the notes app' },
    { id: 'sealed', label: 'Read the spec of the enterprise app acme-vault' },
  ],
  notFound:
    '[warn] {input}: not part of this exercise. Use curl against /apps/appspecifications/<name>, optionally piped into jq. Type help to see the shell.',
};

export default envAndSecretsSpec;
