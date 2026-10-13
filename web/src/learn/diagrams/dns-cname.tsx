/**
 * FIG: pointing your own domain at an app. The chain a lookup follows (your CNAME, the free app address, a
 * load balancer host, an address), then three things that go wrong or surprise: who issues the HTTPS
 * certificate and what a proxy changes, why a new record spreads slowly, and why the bare domain cannot hold
 * a plain CNAME. FACTS 6.4 (FDM custom domains, Let's Encrypt HTTP-01, renew under 30 days, Cloudflare proxy)
 * and 9.7. No durations are drawn for DNS caching: Flux publishes none.
 *
 * Props: `domain` (default `shop.example.com`) and `app` (default `lanternshop`).
 */

import { CUSTOM_CERT_RENEW_BELOW_DAYS } from '@shared/flux';
import type { DiagramComponent, DiagramMeta, DiagramProps } from '@/learn/stage-api';
import { DiagramRoot } from './_kit/Diagram';
import { pt, wrapClamp } from './_kit/geometry';
import { Badge, Chip, chipWidth, Hex, Line, Mark, Txt } from './_kit/parts';
import { str } from './_kit/props';

export const meta: DiagramMeta = {
  id: 'dns-cname',
  title: 'A custom domain, step by step',
  beats: [
    'You own a domain and want visitors to reach your app at that name, not at the free address.',
    'A CNAME record at your DNS provider makes your name an alias of the free app address.',
    'FDM gets the HTTPS certificate once your domain resolves to it. A proxy in front changes the answer.',
    'DNS answers are cached, so a new record spreads one resolver at a time. Flux does not control that clock.',
    'The bare domain cannot hold a plain CNAME. Use a subdomain, an ALIAS or flattened CNAME, or an A record.',
  ],
  alt:
    'A chain of four names a lookup follows: your domain, the free address of the app, a load balancer host and an ' +
    'address, joined by a CNAME you add, a CNAME Flux owns and an A record Flux owns. Three more views: how the ' +
    "HTTPS certificate is issued by FDM through Let's Encrypt when the domain points at FDM, and not when a " +
    'proxy sits in front; how DNS caches make a new record reach resolvers at different times; and why the bare ' +
    'domain needs an ALIAS, a flattened CNAME or an A record instead of a plain CNAME.',
};

const WIDE_MIN = 600;
const LB_HOST = 'fdm-lb-1-2.runonflux.io';

const clean = (s: string): string => s.toLowerCase().replace(/[^a-z0-9.-]/g, '');

const DnsCname: DiagramComponent = ({ beat, props, reducedMotion }: DiagramProps) => {
  const domain = clean(str(props?.domain, 'shop.example.com', 40)) || 'shop.example.com';
  const app = clean(str(props?.app, 'lanternshop', 14)).replace(/\./g, '') || 'lanternshop';
  const appHost = `${app}.app.runonflux.io`;
  const labels = domain.split('.').filter(Boolean);
  const apex = labels.length > 2 ? labels.slice(-2).join('.') : domain;
  const sub = labels.length > 2 ? domain : `www.${apex}`;

  const chain = [
    { label: 'YOUR DOMAIN', name: domain },
    { label: 'THE APP ADDRESS', name: appHost },
    { label: 'LOAD BALANCER HOST', name: LB_HOST },
    { label: 'ADDRESS', name: 'an IP address of the edge' },
  ] as const;
  const records = [
    { type: 'CNAME', who: 'you add this' },
    { type: 'CNAME', who: "Flux's own" },
    { type: 'A', who: "Flux's own" },
  ] as const;

  const PH = 208;

  return (
    <DiagramRoot
      meta={meta}
      beat={beat}
      reducedMotion={reducedMotion}
      height={(W) => (W >= WIDE_MIN ? 20 + 3 * 60 + 40 + 24 : 14 + 3 * 56 + 50 + 14 + PH + 10)}
    >
      {({ W, st }) => {
        const R = W - 36;
        const wide = W >= WIDE_MIN;
        const s0 = st(0);
        const s1 = st(1);
        const sTail = st(1, []);
        const sTls = st(2, 2, 3);
        const sProp = st(3, 3, 4);
        const sApex = st(4);
        const sRec = st(1, 1, 2);

        const m = wide ? 24 : 12;
        const pitch = wide ? 60 : 56;
        const top = wide ? 30 : 24;
        const rowY = (k: number) => top + k * pitch;
        const x0 = m + 20;
        const recChipX = x0 + 28;

        // The panel that swaps between beats 3, 4 and 5.
        const panelW = wide ? Math.min(R - (m + 314), 360) : R - m;
        const panelX = wide ? R - panelW : m;
        const panelY = wide ? 8 : rowY(3) + 50;

        const chainStates = [s0, st(0, 1), sTail, sTail] as const;
        const chainNodes = chain.map((c, k) => {
          const y = rowY(k);
          const s = chainStates[k] ?? sTail;
          return (
            <g key={c.label}>
              <Hex
                cx={x0}
                cy={y}
                r={13}
                s={s}
                wash
                probe={`${c.label.toLowerCase()}: ${c.name}`}
                delay={k * 70}
              />
              <Txt x={x0 + 26} y={y - 8} s={s} ink="dim" hot={false} delay={60 + k * 70}>
                {c.label}
              </Txt>
              <Txt
                x={x0 + 26}
                y={y + 8}
                s={s}
                caps={false}
                ink={k === 3 ? 'dim' : 'lit'}
                semi={k < 3}
                delay={100 + k * 70}
              >
                {c.name}
              </Txt>
            </g>
          );
        });
        const links = records.map((r, k) => {
          const y = rowY(k);
          const y2 = rowY(k + 1);
          const s = k === 0 ? s1 : sTail;
          return (
            <g
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed, ordered layout
              key={`rec-${k}`}
            >
              <Line
                pts={[pt(x0, y + 16), pt(x0, y2 - 16)]}
                arrow
                strong={k === 0}
                flow={k === 0}
                s={s}
                delay={k * 80}
              />
              <Chip
                x={recChipX}
                y={(y + y2) / 2}
                text={r.type}
                s={s}
                caps
                size={10}
                h={20}
                wash={k === 0}
                delay={80 + k * 80}
              />
              <Txt
                x={recChipX + chipWidth(r.type, 10, 8, 0.08) + 10}
                y={(y + y2) / 2}
                s={s}
                caps={false}
                ink="dim"
                hot={false}
                delay={140 + k * 80}
              >
                {r.who}
              </Txt>
            </g>
          );
        });

        const px = panelX;
        const py = panelY;
        const pw = panelW;
        const inner = pw - 28;

        const recordName = labels.length > 2 ? (labels[0] ?? '@') : '@';
        const recRows = [
          { k: 'NAME', v: recordName },
          { k: 'TYPE', v: 'CNAME' },
          { k: 'TARGET', v: appHost },
        ];
        // A value sits beside its label when there is room, and under it when there is not.
        const chipSize = chipWidth(appHost) > inner ? 10 : 11;
        const recLayout = recRows.map((r) => {
          const w = chipWidth(r.v, r.k === 'TARGET' ? chipSize : 11);
          return { ...r, w, below: 76 + w > inner + 8 };
        });
        let ry = py + 46;
        const recY = recLayout.map((r) => {
          const y = ry;
          ry += r.below ? 52 : 34;
          return y;
        });
        const record = (
          <g>
            <Txt x={px + 14} y={py + 12} s={sRec} ink="acc" semi>
              RECORD AT YOUR DNS PROVIDER
            </Txt>
            {recLayout.map((r, i) => {
              const y = recY[i] ?? py + 46;
              return (
                <g key={r.k}>
                  <Txt x={px + 14} y={y} s={sRec} ink="dim" hot={false} delay={80 + i * 100}>
                    {r.k}
                  </Txt>
                  <Chip
                    x={r.below ? px + 14 : px + 76}
                    y={r.below ? y + 20 : y}
                    text={r.v}
                    s={sRec}
                    size={r.k === 'TARGET' ? chipSize : 11}
                    wash={i === 2}
                    delay={100 + i * 100}
                  />
                </g>
              );
            })}
            <Txt x={px + 14} y={ry + 4} s={sRec} caps={false} ink="dim" hot={false} lh={15} delay={440}>
              {wrapClamp(
                'The target is your free address, spelled exactly. A wrong letter saves without a warning.',
                inner,
                11,
                4,
              )}
            </Txt>
          </g>
        );

        const tls = (
          <g>
            <Badge n={3} at={pt(px + 12, py + 12)} s={sTls} delay={100} />
            <Txt x={px + 30} y={py + 12} s={sTls} ink="acc" semi>
              HTTPS CERTIFICATE
            </Txt>
            {[
              {
                name: 'direct',
                mid: 'FDM',
                end: "Let's Encrypt",
                ok: true,
                text: `FDM gets it, and renews it with under ${CUSTOM_CERT_RENEW_BELOW_DAYS} days left.`,
              },
              {
                name: 'proxy',
                mid: 'proxy',
                end: 'FDM',
                ok: false,
                text: "FDM issues nothing. The proxy's certificate serves visitors.",
              },
            ].map((lane, i) => {
              const y = py + 46 + i * 88;
              const a = px + 44;
              const b = px + pw / 2;
              const c = px + pw - 44;
              return (
                <g key={lane.name}>
                  <Hex cx={a} cy={y} r={13} s={sTls} wash delay={i * 100}>
                    <Txt bare x={a} y={y} anchor="middle" caps={false} semi ink="lit" hot={false} size={9}>
                      you
                    </Txt>
                  </Hex>
                  <Line pts={[pt(a + 16, y), pt(b - 16, y)]} arrow s={sTls} delay={80 + i * 100} />
                  <Hex
                    cx={b}
                    cy={y}
                    r={13}
                    s={sTls}
                    wash
                    tone={lane.ok ? undefined : 'warn'}
                    delay={120 + i * 100}
                  >
                    <Txt
                      bare
                      x={b}
                      y={y + 0.5}
                      anchor="middle"
                      caps={false}
                      semi
                      ink="lit"
                      hot={false}
                      size={8}
                    >
                      {lane.ok ? 'FDM' : 'prx'}
                    </Txt>
                  </Hex>
                  <Line
                    pts={[pt(b + 16, y), pt(c - 16, y)]}
                    arrow={lane.ok}
                    arrowStart={lane.ok}
                    dashed={!lane.ok}
                    kind={lane.ok ? 'ann' : 'line'}
                    tone={lane.ok ? undefined : 'crit'}
                    s={sTls}
                    delay={160 + i * 100}
                  />
                  <Hex
                    cx={c}
                    cy={y}
                    r={13}
                    s={sTls}
                    wash
                    tone={lane.ok ? undefined : 'crit'}
                    delay={200 + i * 100}
                  >
                    <Txt
                      bare
                      x={c}
                      y={y + 0.5}
                      anchor="middle"
                      caps={false}
                      semi
                      ink="lit"
                      hot={false}
                      size={8}
                    >
                      {lane.ok ? 'LE' : 'FDM'}
                    </Txt>
                  </Hex>
                  {!lane.ok && (
                    <Mark kind="x" x={(b + c) / 2} y={y - 10} s={sTls} tone="crit" size={4.5} delay={320} />
                  )}
                  {lane.ok && (
                    <Mark kind="check" x={(b + c) / 2} y={y - 10} s={sTls} tone="ok" size={4.5} delay={320} />
                  )}
                  <Txt
                    x={a}
                    y={y + 26}
                    s={sTls}
                    anchor="middle"
                    caps={false}
                    ink="dim"
                    hot={false}
                    size={10}
                    delay={200}
                  >
                    your domain
                  </Txt>
                  <Txt
                    x={b}
                    y={y + 26}
                    s={sTls}
                    anchor="middle"
                    caps={false}
                    ink="dim"
                    hot={false}
                    size={10}
                    delay={220}
                  >
                    {lane.ok ? 'FDM' : 'proxy'}
                  </Txt>
                  <Txt
                    x={c}
                    y={y + 26}
                    s={sTls}
                    anchor="middle"
                    caps={false}
                    ink="dim"
                    hot={false}
                    size={10}
                    delay={240}
                  >
                    {lane.end}
                  </Txt>
                  <Txt x={px + 14} y={y + 44} s={sTls} caps={false} ink="lit" hot={false} lh={15} delay={280}>
                    {wrapClamp(lane.text, inner, 11, 3)}
                  </Txt>
                </g>
              );
            })}
          </g>
        );

        // The room each resolver column has for its chip.
        const chipRoom = (pw - 88) / 2;
        const propagation = (
          <g>
            <Badge n={4} at={pt(px + 12, py + 12)} s={sProp} delay={100} />
            <Txt x={px + 30} y={py + 12} s={sProp} ink="acc" semi>
              CACHED ANSWERS
            </Txt>
            {[
              { n: 1, fresh: true },
              { n: 2, fresh: false },
              { n: 3, fresh: false },
            ].map((r, i) => {
              const x = px + 44 + ((pw - 88) * i) / 2;
              const y = py + 58;
              return (
                <g key={r.n}>
                  <Hex cx={x} cy={y} r={16} s={sProp} wash tone={r.fresh ? 'ok' : 'warn'} delay={i * 100}>
                    <Txt bare x={x} y={y} anchor="middle" caps={false} semi ink="lit" hot={false} size={10}>
                      {String(r.n)}
                    </Txt>
                  </Hex>
                  <Txt
                    x={x}
                    y={y + 30}
                    s={sProp}
                    anchor="middle"
                    caps={false}
                    ink="dim"
                    hot={false}
                    size={10}
                    delay={160 + i * 100}
                  >
                    resolver
                  </Txt>
                  <Chip
                    x={x}
                    y={y + 52}
                    text={chipRoom >= 80 ? (r.fresh ? 'new answer' : 'old answer') : r.fresh ? 'new' : 'old'}
                    anchor="middle"
                    s={sProp}
                    size={10}
                    h={20}
                    delay={200 + i * 100}
                  />
                </g>
              );
            })}
            <Txt x={px + 14} y={py + 138} s={sProp} caps={false} ink="lit" hot={false} lh={15} delay={320}>
              {wrapClamp(
                'Each resolver keeps its answer until its own cache time runs out. Flux does not control that clock.',
                inner,
                11,
                4,
              )}
            </Txt>
          </g>
        );

        const apexOpts = [
          'an ALIAS or flattened CNAME',
          'an A record to the FDM addresses',
          `or ${sub} with a CNAME`,
        ];
        const optLines = apexOpts.map((o) => wrapClamp(o, pw - 46, 11, 2));
        let oy = py + 80;
        const optY = optLines.map((l) => {
          const y = oy;
          oy += (l.length - 1) * 15 + 22;
          return y;
        });
        const bare = (
          <g>
            <Badge n={5} at={pt(px + 12, py + 12)} s={sApex} delay={100} />
            <Txt x={px + 30} y={py + 12} s={sApex} ink="acc" semi>
              THE BARE DOMAIN
            </Txt>
            <Chip x={px + 14} y={py + 46} text={apex} s={sApex} wash delay={60} />
            <Mark
              kind="x"
              x={px + 14 + chipWidth(apex) + 18}
              y={py + 46}
              s={sApex}
              tone="crit"
              size={5}
              delay={200}
            />
            <Txt
              x={px + 14 + chipWidth(apex) + 32}
              y={py + 46}
              s={sApex}
              caps={false}
              tone="crit"
              hot={false}
              delay={240}
            >
              plain CNAME
            </Txt>
            {apexOpts.map((o, i) => (
              <g key={o}>
                <Mark
                  kind="check"
                  x={px + 22}
                  y={optY[i] ?? py + 80}
                  s={sApex}
                  tone="ok"
                  size={4.5}
                  delay={280 + i * 80}
                />
                <Txt
                  x={px + 40}
                  y={optY[i] ?? py + 80}
                  s={sApex}
                  caps={false}
                  ink="lit"
                  hot={false}
                  lh={15}
                  delay={300 + i * 80}
                >
                  {optLines[i] ?? o}
                </Txt>
              </g>
            ))}
            <Txt x={px + 14} y={oy + 2} s={sApex} caps={false} ink="dim" hot={false} lh={15} delay={560}>
              {wrapClamp(
                'FDM also serves www. and test. names. Each needs a record of its own.',
                inner,
                11,
                3,
              )}
            </Txt>
          </g>
        );

        return (
          <>
            {chainNodes}
            {links}
            <Badge n={1} at={pt(wide ? panelX - 16 : R - 12, rowY(0))} s={s0} delay={100} />
            <Badge n={2} at={pt(wide ? panelX - 16 : R - 12, (rowY(0) + rowY(1)) / 2)} s={s1} delay={140} />
            {record}
            {tls}
            {propagation}
            {bare}
          </>
        );
      }}
    </DiagramRoot>
  );
};

export default DnsCname;
