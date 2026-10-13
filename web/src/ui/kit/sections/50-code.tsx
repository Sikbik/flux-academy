import { CodeBlock, CodeBlockSkeleton } from '../..';
import { Col, Grid, Group, type KitSectionMeta, Spec, Sub } from '../parts';

export const meta: KitSectionMeta = { id: 'code', title: 'Code', order: 50 };

const DOCKERFILE = `# Build stage
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

# Runtime stage
FROM nginx:1.27-alpine
ENV PORT=8080
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:8080 || exit 1
CMD ["nginx", "-g", "daemon off;"]`;

const SPEC_JSON = `{
  "version": 8,
  "name": "hello-flux",
  "description": "A small web server on three nodes",
  "owner": "1AbCdEfGhIjKlMnOpQrStUvWxYz",
  "instances": 3,
  "compose": [
    {
      "name": "web",
      "repotag": "nginx:1.27-alpine",
      "ports": [31001],
      "containerPorts": [80],
      "cpu": 0.5,
      "ram": 500,
      "hdd": 2,
      "tiered": false,
      "secrets": null
    }
  ]
}`;

const TS = `import { useEffect, useState } from 'react';

type Status = 'live' | 'syncing' | 'offline';

interface Node {
  ip: string;
  status: Status;
  // Milliseconds since the last heartbeat.
  age: number;
}

export function useNodes(appName: string): Node[] {
  const [nodes, setNodes] = useState<Node[]>([]);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(\`/api/apps/\${appName}/nodes\`, { signal: ctrl.signal })
      .then((res) => res.json() as Promise<Node[]>)
      .then(setNodes);
    return () => ctrl.abort();
  }, [appName]);
  return nodes;
}`;

const SHELL = `$ docker build -t hello-flux:1.0 .
[+] Building 12.4s (9/9) FINISHED
$ docker run --rm -p 8080:80 hello-flux:1.0
$ curl -I http://localhost:8080
HTTP/1.1 200 OK`;

const YAML = `services:
  web:
    image: nginx:1.27-alpine
    ports:
      - "8080:80"
    environment:
      - MODE=production
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost"]
      interval: 30s
    # Restart when the process exits.
    restart: unless-stopped`;

const JS = `// Pick the three healthiest nodes.
export function pick(nodes, count = 3) {
  return nodes
    .filter((n) => n.status === 'live')
    .sort((a, b) => a.age - b.age)
    .slice(0, count);
}`;

const ONE_LINE = 'docker run -d --name web -p 8080:80 nginx:1.27-alpine';

const LONG_LINE =
  'curl --silent --show-error --fail --location --max-time 30 --header "Accept: application/json" --header "X-Flux-Request: kit-specimen" "https://example.com/api/v1/apps/hello-flux/instances?limit=100&offset=0&sort=age"';

const PLAIN = `NAME           STATUS    NODES
hello-flux     live      3
notes-api      syncing   2
gallery        offline   0`;

const MANY = Array.from(
  { length: 40 },
  (_, i) => `line ${String(i + 1).padStart(2, '0')}: the quick brown fox`,
).join('\n');

export default function CodeSection() {
  return (
    <Group
      id="code"
      title="Code"
      lead="A slab with a mono header, a gutter that stays put while long lines scroll, and a screen you can reach with the keyboard. Highlighting is in-house and forgiving: it never throws and the text it returns is always exactly the source. Copy gives the source (a shell session copies the commands without prompts or output)."
    >
      <Sub>Languages</Sub>
      <Grid min={440}>
        <Spec
          label="dockerfile, filename, highlight lines 3 and 12"
          note="The accent band and marker; a screen reader hears Highlighted on those lines."
        >
          <CodeBlock lang="dockerfile" filename="Dockerfile" code={DOCKERFILE} highlight={[3, 12]} />
        </Spec>
        <Spec label="json">
          <CodeBlock lang="json" filename="flux-spec.json" code={SPEC_JSON} />
        </Spec>
        <Spec label="ts">
          <CodeBlock lang="ts" filename="useNodes.ts" code={TS} />
        </Spec>
        <Col gap={20}>
          <Spec
            label="sh, prompts dim and never copied"
            note="Output lines are dim; Copy returns the three commands only."
          >
            <CodeBlock lang="sh" title="Terminal" code={SHELL} />
          </Spec>
          <Spec label="js">
            <CodeBlock lang="js" filename="pick.js" code={JS} />
          </Spec>
        </Col>
        <Spec label="yaml">
          <CodeBlock lang="yaml" filename="docker-compose.yml" code={YAML} />
        </Spec>
        <Spec label="text, no highlighting">
          <CodeBlock lang="text" title="Output" code={PLAIN} />
        </Spec>
      </Grid>

      <Sub>Shape and behaviour</Sub>
      <Grid min={440}>
        <Spec
          label="one line, no gutter, no filename"
          note="Line numbers default to on only when there is more than one line."
        >
          <CodeBlock lang="sh" code={ONE_LINE} label="Run the container" />
        </Spec>
        <Spec
          label="a very long line scrolls inside the block"
          note="Click into the block and use the arrow keys; the gutter stays."
        >
          <CodeBlock
            lang="sh"
            filename="request.sh"
            code={`# A request with every header spelled out.\n${LONG_LINE}\necho done`}
          />
        </Spec>
        <Spec label="wrap" note="Wrapped lines hang under the code, not under the numbers.">
          <CodeBlock
            lang="sh"
            filename="request.sh"
            wrap
            code={`# A request with every header spelled out.\n${LONG_LINE}\necho done`}
          />
        </Spec>
        <Spec label="maxHeight 200 and startLine 41" note="An excerpt: the gutter starts where the file did.">
          <CodeBlock lang="text" title="Build log" code={MANY} maxHeight={200} startLine={41} />
        </Spec>
        <Spec label="caption">
          <CodeBlock
            lang="yaml"
            filename="docker-compose.yml"
            code={'services:\n  web:\n    image: nginx:1.27-alpine'}
            caption="The smallest compose file that runs a web server."
          />
        </Spec>
        <Spec
          label="keyboard focus (forced)"
          note="The screen takes the one-shot beam; the steady state is the bright rim."
        >
          <CodeBlock
            data-force="focus"
            lang="json"
            filename="node.json"
            code={'{\n  "ip": "203.0.113.7",\n  "status": "live"\n}'}
          />
        </Spec>
        <Spec label="loading">
          <CodeBlockSkeleton filename="Dockerfile" lang="dockerfile" skeletonLines={6} />
        </Spec>
        <Spec label="copy off">
          <CodeBlock lang="json" copy={false} code={'{ "instances": 3 }'} title="Read only" />
        </Spec>
      </Grid>
    </Group>
  );
}
