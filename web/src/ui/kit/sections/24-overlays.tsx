import { useState } from 'react';
import {
  Button,
  Dialog,
  Drawer,
  IconButton,
  Popover,
  Surface,
  Toast,
  type ToastItem,
  ToastViewport,
  Tooltip,
} from '../..';
import { Col, Grid, Group, type KitSectionMeta, Row, Spec, Sub } from '../parts';

export const meta: KitSectionMeta = { id: 'overlays', title: 'Overlays', order: 24 };

let counter = 0;

export default function Overlays() {
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [drawer, setDrawer] = useState<null | 'auto' | 'bottom'>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const push = (kind: 'info' | 'success' | 'warn' | 'error', text: string) => {
    const id = `t${++counter}`;
    setToasts((t) => [...t, { id, kind, children: text, duration: 2400 }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2400);
  };

  return (
    <Group
      id="overlays"
      title="Overlays"
      lead="Tooltips and popovers float above the page and never trap it. Dialogs and drawers are modal: focus is trapped, the page behind is inert and scroll-locked, Escape closes, focus returns. Drawers become bottom sheets on phones."
    >
      <Sub>Surface (the light floating glass under tooltips, popovers and toasts)</Sub>
      <Row>
        {(['sm', 'md', 'lg'] as const).map((size) => (
          <Surface key={size} size={size}>
            <span style={{ display: 'block', padding: '8px 14px', fontSize: 'var(--fs-sm)' }}>
              size {size}
            </span>
          </Surface>
        ))}
        {(['ok', 'warn', 'crit', 'cumulus', 'nimbus', 'stratus'] as const).map((tone) => (
          <Surface key={tone} size="sm" tone={tone}>
            <span style={{ display: 'block', padding: '8px 12px', fontSize: 'var(--fs-sm)' }}>{tone}</span>
          </Surface>
        ))}
      </Row>

      <Sub>Tooltip (hover or focus; Escape dismisses)</Sub>
      <Row>
        {(['top', 'bottom', 'left', 'right'] as const).map((p) => (
          <Tooltip key={p} content={`Placement ${p}`} placement={p}>
            <Button variant="secondary" size="sm">
              {p}
            </Button>
          </Tooltip>
        ))}
        <IconButton icon="keyboard" label="Shortcuts" shortcut="?" />
      </Row>

      <Sub>Popover (a hairline stem and a dot connect it to the trigger)</Sub>
      <Row>
        <Popover
          title="CPU"
          content={
            <>
              <p>Cores of compute, in tenths of a vCPU. More CPU raises the monthly price.</p>
              <p>
                <a className="link" href="#overlays">
                  Read the field reference
                </a>
              </p>
            </>
          }
        >
          <IconButton icon="help" label="About CPU" tooltip={false} />
        </Popover>
        <Popover
          trigger="hover"
          placement="top"
          title="FluxNode"
          content="An independent machine that runs containers and is paid every block."
        >
          <button type="button" className="link" style={{ borderBlockEnd: '1px dotted currentColor' }}>
            FluxNode
          </button>
        </Popover>
        <Popover
          defaultOpen
          placement="right"
          label="Open by default"
          content="Open on mount for the gallery."
        >
          <Button variant="secondary" size="sm">
            Open popover
          </Button>
        </Popover>
      </Row>

      <Sub>Dialog and drawer</Sub>
      <Row>
        <Button variant="secondary" onClick={() => setDialog(true)}>
          Open dialog
        </Button>
        <Button variant="danger" onClick={() => setConfirm(true)}>
          Destructive confirm
        </Button>
        <Button variant="secondary" onClick={() => setDrawer('auto')}>
          Drawer (right, a sheet on phones)
        </Button>
        <Button variant="secondary" onClick={() => setDrawer('bottom')}>
          Bottom sheet
        </Button>
      </Row>

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="What is a spec?"
        description="A JSON file that says what to run and how big it should be."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(false)}>
              Close
            </Button>
            <Button variant="primary" onClick={() => setDialog(false)} data-autofocus>
              Got it
            </Button>
          </>
        }
      >
        <p>
          You register the spec on the chain, nodes see it in the next block and the network places the
          instances. Everything else is the same as running a container anywhere.
        </p>
        <p style={{ marginBlockStart: 12 }}>
          Floating cards work inside a modal:{' '}
          <Popover
            title="Instance"
            content="One running copy of your container, on one node. A spec asks for several."
          >
            <button type="button" className="link" data-testid="dialog-popover">
              what is an instance?
            </button>
          </Popover>
        </p>
      </Dialog>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Reset progress?"
        role="alertdialog"
        tone="crit"
        size="sm"
        dismissOnScrim={false}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)} data-autofocus>
              Keep it
            </Button>
            <Button variant="danger" onClick={() => setConfirm(false)}>
              Reset
            </Button>
          </>
        }
      >
        <p>This erases your XP, rank and achievements on this device. It cannot be undone.</p>
      </Dialog>

      <Drawer
        open={drawer !== null}
        side={drawer ?? 'auto'}
        onClose={() => setDrawer(null)}
        title="Outline"
        description="All steps in this lesson."
        footer={<Button onClick={() => setDrawer(null)}>Close</Button>}
      >
        <Col gap={10}>
          {['What is Flux', 'Nodes and tiers', 'Placement', 'Failover', 'Checkpoint'].map((t, i) => (
            <span key={t} className="t-label">
              {String(i + 1).padStart(2, '0')} / {t}
            </span>
          ))}
        </Col>
      </Drawer>

      <Sub>Toast (the view; the queue belongs to the app)</Sub>
      <Grid min={320}>
        <Spec label="info">
          <Toast kind="info">Spec copied to the clipboard</Toast>
        </Spec>
        <Spec label="success with action and timeline">
          <Toast
            kind="success"
            action={{ label: 'Undo', onClick: () => {} }}
            duration={6000}
            onDismiss={() => {}}
          >
            Instances set to 3
          </Toast>
        </Spec>
        <Spec label="warn">
          <Toast kind="warn">Showing the last known numbers</Toast>
        </Spec>
        <Spec label="error">
          <Toast kind="error" onDismiss={() => {}}>
            The spec was rejected: port 8080 is already used
          </Toast>
        </Spec>
      </Grid>

      <Sub>Viewport (push a few; they stack bottom-start and expire)</Sub>
      <Row>
        <Button variant="secondary" size="sm" onClick={() => push('info', 'Link copied')}>
          Push info
        </Button>
        <Button variant="secondary" size="sm" onClick={() => push('success', 'Step complete, +20 XP')}>
          Push success
        </Button>
        <Button variant="secondary" size="sm" onClick={() => push('error', 'Could not reach the network')}>
          Push error
        </Button>
      </Row>
      <ToastViewport toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </Group>
  );
}
