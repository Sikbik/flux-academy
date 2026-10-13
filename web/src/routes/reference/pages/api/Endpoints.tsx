import { useMemo } from 'react';
import { Link } from 'react-router';
import { anchor } from '@/content/reference';
import { curlFor, endpointsOf } from '@/content/reference/api';
import { API_GROUPS, API_HOSTS } from '@/content/reference/endpoints.data';
import { sampleText } from '@/content/reference/samples';
import { API_GROUP_IDS, type Endpoint } from '@/content/reference/types';
import { Callout, CodeBlock } from '@/ui';
import { useOpenSet } from '../../hooks';
import { DisclosureRow, ExpandAll } from '../../parts/Disclosure';
import { Slab } from '../../parts/Facts';
import { Section } from '../../parts/Heading';
import { Md, P } from '../../parts/Prose';
import { ProvChips } from '../../parts/Prov';
import { Ul } from '../../parts/Semantics';
import styles from './api.module.css';

const ALL = API_GROUP_IDS.flatMap((g) => endpointsOf(g));
const IDS = ALL.map((e) => anchor.endpoint(e.id));

function EndpointBody({ e }: { e: Endpoint }) {
  const sample = useMemo(() => sampleText(e.sample), [e.sample]);
  return (
    <>
      <p className={styles.returns}>
        <span className={styles.label}>Returns</span> <Md text={e.returns} />
      </p>

      {e.params.length > 0 ? (
        <div>
          <p className={styles.label}>Parameters</p>
          <Ul className={styles.params}>
            {e.params.map((p) => (
              <li key={p.name} className={styles.param}>
                <code className={styles.paramName}>{p.name}</code>
                <span className={styles.paramMeta}>
                  {p.where}, {p.required ? 'required' : 'optional'}
                </span>
                <span className={styles.paramText}>
                  <Md text={p.text} />
                </span>
              </li>
            ))}
          </Ul>
        </div>
      ) : (
        <p className={styles.noParams}>No parameters.</p>
      )}

      {e.warning ? (
        <Callout kind="gotcha" compact>
          <Md text={e.warning} />
        </Callout>
      ) : null}
      {e.nodeLocal ? (
        <Callout kind="tip" compact title="About one node">
          This answers about the node that served the request, not about the network. Through the gateway it
          is whichever node was picked.
        </Callout>
      ) : null}

      <CodeBlock
        lang="sh"
        filename="curl"
        code={curlFor(e)}
        wrap
        label={`curl command for ${e.method} ${e.path}`}
      />
      {sample ? (
        <CodeBlock
          lang="json"
          title="A real response, trimmed"
          code={sample}
          maxHeight={340}
          label={`Sample response of ${e.path}`}
        />
      ) : null}

      {e.notes.length > 0 ? (
        <Ul className={styles.notes}>
          {e.notes.map((n) => (
            <li key={n}>
              <Md text={n} />
            </li>
          ))}
        </Ul>
      ) : null}
      <ProvChips prov={e.prov} />
    </>
  );
}

function EndpointRow({
  e,
  open,
  onOpenChange,
}: {
  e: Endpoint;
  open: boolean;
  onOpenChange: (id: string, open: boolean) => void;
}) {
  const id = anchor.endpoint(e.id);
  return (
    <DisclosureRow
      id={id}
      label={`${e.method} ${e.path}`}
      level={4}
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className={styles.route}>
          <span className={styles.method} data-method={e.method}>
            {e.method}
          </span>
          <span className={styles.path}>{e.path}</span>
        </span>
      }
      meta={
        <>
          <span className={styles.host}>{API_HOSTS[e.host].name}</span>
          {e.nodeLocal ? <span className={styles.host}>One node</span> : null}
        </>
      }
      aside={
        <>
          cache {e.cache}
          <span className={styles.sep}> · </span>
          {e.size}
        </>
      }
      summary={<P text={e.summary} className={styles.summary} />}
    >
      <EndpointBody e={e} />
    </DisclosureRow>
  );
}

/** Every endpoint, grouped, each a row that opens to its parameters, a curl line and a real sample. */
export function Endpoints() {
  const { open, set, setAll } = useOpenSet(IDS);
  const allOpen = open.size === IDS.length;
  return (
    <>
      <Section id="endpoints" actions={<ExpandAll allOpen={allOpen} onChange={setAll} count={IDS.length} />}>
        <P
          text={`${ALL.length} read only calls in five groups. Each row opens to its parameters, a runnable curl line and a real response. Cache windows and sizes are what was observed on the day of testing and are marked as such.`}
        />
        <Ul className={styles.groupLinks}>
          {API_GROUPS.map((g) => (
            <li key={g.id}>
              <Link to={{ hash: `#endpoints-${g.id}` }} className={styles.groupLink}>
                {g.label}
                <span className={styles.groupCount}>{endpointsOf(g.id).length}</span>
              </Link>
            </li>
          ))}
        </Ul>
      </Section>
      {API_GROUPS.map((g) => (
        <Section key={g.id} id={`endpoints-${g.id}`}>
          <Slab>
            <div className={styles.rows}>
              {endpointsOf(g.id).map((e) => (
                <EndpointRow key={e.id} e={e} open={open.has(anchor.endpoint(e.id))} onOpenChange={set} />
              ))}
            </div>
          </Slab>
        </Section>
      ))}
    </>
  );
}
