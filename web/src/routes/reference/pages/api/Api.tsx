import { API_PATHS, API_PREFIX } from '@shared/api';
import { Link } from 'react-router';
import { anchor } from '@/content/reference';
import {
  ACADEMY_ENVELOPE,
  ACADEMY_ERROR,
  buildAcademyRoutes,
  buildBudget,
  buildEnvelopeFacts,
  buildExcluded,
  buildHostFacts,
  buildHosts,
  buildLimitFacts,
  buildMisleading,
  calculatorSpec,
  curlFor,
  ENVELOPE_ERROR,
  ENVELOPE_SUCCESS,
  FETCH_HELPER,
} from '@/content/reference/api';
import { ENDPOINTS } from '@/content/reference/endpoints.data';
import { sampleText } from '@/content/reference/samples';
import { Callout, CodeBlock } from '@/ui';
import { CopyValue } from '../../parts/CopyValue';
import { type Column, DataTable, FactList, Slab } from '../../parts/Facts';
import { CopyLink, Section } from '../../parts/Heading';
import { KeyFact, Md, P } from '../../parts/Prose';
import { ProvChips } from '../../parts/Prov';
import styles from './api.module.css';

const HOSTS = buildHosts();

export function BaseUrls() {
  const columns: Column<(typeof HOSTS)[number]>[] = [
    {
      id: 'title',
      label: 'Host',
      primary: true,
      render: (h) => (
        <span className={styles.rowLink}>
          {h.title}
          <CopyLink id={anchor.host(h.id)} label={h.title} />
        </span>
      ),
    },
    {
      id: 'url',
      label: 'Address',
      render: (h) => (
        <span className={styles.urlCell}>
          <code>{h.url}</code>
          <CopyValue text={h.url} label={`Copy the address of ${h.title}`} />
        </span>
      ),
    },
    {
      id: 'text',
      label: 'What it is',
      render: (h) => (
        <>
          <p>
            <Md text={h.text} />
          </p>
          <ProvChips prov={h.prov} />
        </>
      ),
    },
  ];
  return (
    <Section id="base-urls">
      <DataTable
        caption="Where requests go"
        columns={columns}
        rows={HOSTS}
        rowId={(h) => anchor.host(h.id)}
      />
      <FactList section="base-urls" rows={buildHostFacts()} />
    </Section>
  );
}

export function Envelope() {
  return (
    <Section id="envelope">
      <KeyFact label="HTTP 200 is not success">
        <p>
          The gateway answers <code>200</code> for a failed call too. The result is in the body:{' '}
          <code>status</code> is <code>success</code> or <code>error</code>. Check it before you read{' '}
          <code>data</code>.
        </p>
      </KeyFact>
      <div className={styles.twoUp}>
        <CodeBlock lang="json" title="Success" code={ENVELOPE_SUCCESS} wrap />
        <CodeBlock lang="json" title="Failure" code={ENVELOPE_ERROR} wrap />
      </div>
      <FactList section="envelope" rows={buildEnvelopeFacts()} />
      <CodeBlock
        lang="js"
        filename="flux.js"
        code={FETCH_HELPER}
        caption="A small helper that follows these rules. Written for this page, not taken from FluxOS."
      />
    </Section>
  );
}

export function Limits() {
  const budget = buildBudget();
  const columns: Column<(typeof budget)[number]>[] = [
    {
      id: 'pattern',
      label: 'You are building',
      primary: true,
      render: (b) => (
        <span className={styles.rowLink}>
          {b.pattern}
          <CopyLink id={anchor.budget(b.id)} label={b.pattern} />
        </span>
      ),
    },
    { id: 'advice', label: 'Request budget', render: (b) => <Md text={b.advice} /> },
  ];
  return (
    <Section id="limits">
      <FactList section="limits" rows={buildLimitFacts()} />
      <DataTable
        caption="How often to call, by what you are building"
        columns={columns}
        rows={budget}
        rowId={(b) => anchor.budget(b.id)}
      />
    </Section>
  );
}

export function Calculator() {
  const e = ENDPOINTS.find((x) => x.id === 'apps-calculatefiatandfluxprice');
  if (!e) return null;
  return (
    <Section id="calculator">
      <KeyFact label="The one thing that goes wrong">
        <p>
          Send the spec as <code>Content-Type: text/plain</code>. With <code>application/json</code> the
          request hangs and the gateway answers 504 after its timeout. The call only reads: it prices a spec
          and registers nothing.
        </p>
      </KeyFact>
      <CodeBlock
        lang="sh"
        filename="curl"
        code={curlFor(e)}
        wrap
        label="curl command for the price calculator"
      />
      <div className={styles.twoUp}>
        <CodeBlock
          lang="json"
          title="The body is the spec as text"
          code={JSON.stringify(JSON.parse(calculatorSpec()), null, 2)}
          maxHeight={300}
          label="Request body"
        />
        <CodeBlock lang="json" title="The answer" code={sampleText(e.sample)} label="Response" />
      </div>
      <Callout kind="tip" compact>
        The full entry, with its parameters and notes, is under{' '}
        <Link to={{ hash: `#${anchor.endpoint(e.id)}` }} className="link">
          Prices and limits
        </Link>
        . To price a spec without a request, Spec Forge applies the same formula in your browser.
      </Callout>
    </Section>
  );
}

const MIS = buildMisleading();

export function Misleading() {
  const columns: Column<(typeof MIS)[number]>[] = [
    {
      id: 'item',
      label: 'In older material',
      primary: true,
      render: (m) => (
        <span className={styles.rowLink}>
          <Md text={m.item} />
          <CopyLink id={anchor.misleading(m.id)} label="this item" />
        </span>
      ),
    },
    { id: 'status', label: 'What is true now', render: (m) => <Md text={m.status} /> },
    { id: 'prov', label: 'Basis', bare: true, render: (m) => <ProvChips prov={m.prov} /> },
  ];
  return (
    <Section id="misleading">
      <DataTable
        caption="Endpoints and fields that older material gets wrong"
        columns={columns}
        rows={MIS}
        rowId={(m) => anchor.misleading(m.id)}
      />
    </Section>
  );
}

export function LeftOut() {
  return (
    <Section id="left-out">
      <FactList section="left-out" rows={buildExcluded()} />
    </Section>
  );
}

const ROUTES = buildAcademyRoutes();

export function AcademyApi() {
  const columns: Column<(typeof ROUTES)[number]>[] = [
    {
      id: 'route',
      label: 'Route',
      primary: true,
      mono: true,
      render: (r) => (
        <span className={styles.rowLink}>
          <span className={styles.method} data-method={r.method}>
            {r.method}
          </span>
          <code>{r.path}</code>
          <CopyLink id={anchor.academy(r.id)} label={`${r.method} ${r.path}`} />
        </span>
      ),
    },
    { id: 'shape', label: 'Contract', mono: true, render: (r) => r.shape },
    { id: 'text', label: 'What it does', render: (r) => <Md text={r.text} /> },
  ];
  return (
    <Section id="academy-api">
      <P
        text={`These are the routes of this site's own server: everything under \`${API_PREFIX}\`, and \`${API_PATHS.healthz}\` for liveness. They are described only as far as their contract file describes them, so the shapes are named and not reproduced. A successful answer carries \`meta\`, which says where the data came from (\`live\`, \`cache\` or \`fallback\`) and how old it is.`}
      />
      <DataTable
        caption="The Academy's own routes"
        columns={columns}
        rows={ROUTES}
        rowId={(r) => anchor.academy(r.id)}
      />
      <div className={styles.twoUp}>
        <CodeBlock lang="json" title="A successful answer" code={ACADEMY_ENVELOPE} wrap />
        <CodeBlock lang="json" title="A failed answer" code={ACADEMY_ERROR} wrap />
      </div>
      <p className={styles.dim}>
        These routes serve the Academy's own pages and may change with the site. For the network itself, use
        the Flux API above.
      </p>
    </Section>
  );
}

export function TryIt() {
  return (
    <Section id="try-it">
      <Slab padded>
        <div className={styles.tryIt}>
          <div>
            <p className={styles.tryTitle}>Look up a real app</p>
            <p className={styles.tryText}>
              The network explorer lab calls these endpoints for you: type an app name and see its owner,
              instances and where it runs, with the raw response beside it.
            </p>
          </div>
          <Link to="/labs/explorer" className={styles.tryLink}>
            Open the explorer
          </Link>
        </div>
      </Slab>
    </Section>
  );
}
