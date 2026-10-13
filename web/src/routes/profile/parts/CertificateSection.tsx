import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  buildCertificate,
  CERT_HEIGHT,
  CERT_WIDTH,
  type CertificateAssets,
  type CertificateModel,
  downloadBlob,
  drawCertificate,
  ensureCertificateFonts,
  loadCertificateAssets,
  MAX_NAME,
  renderCertificatePng,
} from '@/learn/certificate';
import type { LessonProgress } from '@/learn/store';
import { announce } from '@/system/announce';
import { toast } from '@/system/toasts';
import { Button, Glyph, Panel, TextField } from '@/ui';
import styles from './CertificateSection.module.css';

export interface CertificateSectionProps {
  name: string;
  onNameChange: (name: string) => void;
  lessons: Readonly<Record<string, LessonProgress>>;
  /** Lessons finished and total in the first unfinished track, for the locked message. */
  nextTrack: { name: string; done: number; total: number; rankName: string } | null;
}

type Load = 'loading' | 'ready' | 'failed';

/** The certificate drawn live on a canvas, from the same code that makes the download. */
function Preview({
  model,
  onState,
  assetsRef,
}: {
  model: CertificateModel;
  onState: (s: Load) => void;
  assetsRef: React.MutableRefObject<CertificateAssets | null>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [load, setLoad] = useState<Load>('loading');

  useEffect(() => {
    let alive = true;
    Promise.all([loadCertificateAssets(), ensureCertificateFonts()])
      .then(([assets]) => {
        if (!alive) return;
        assetsRef.current = assets;
        setLoad('ready');
        onState('ready');
      })
      .catch(() => {
        if (!alive) return;
        setLoad('failed');
        onState('failed');
      });
    return () => {
      alive = false;
    };
  }, [assetsRef, onState]);

  useEffect(() => {
    if (load !== 'ready') return;
    const ctx = canvas.current?.getContext('2d');
    const assets = assetsRef.current;
    if (ctx && assets) drawCertificate(ctx, model, assets, 1);
  }, [load, model, assetsRef]);

  return (
    <div className={styles.plate} data-earned={model.earned ? 'true' : 'false'} data-load={load}>
      <canvas
        ref={canvas}
        className={styles.canvas}
        width={CERT_WIDTH}
        height={CERT_HEIGHT}
        role="img"
        aria-label={model.altText}
      />
      {load === 'loading' ? <p className={styles.state}>Drawing the certificate</p> : null}
      {load === 'failed' ? (
        <p className={styles.state}>The preview could not be drawn. Reload the page and try again.</p>
      ) : null}
    </div>
  );
}

export function CertificateSection({ name, onNameChange, lessons, nextTrack }: CertificateSectionProps) {
  const reasonId = useId();
  const assetsRef = useRef<CertificateAssets | null>(null);
  const [load, setLoad] = useState<Load>('loading');
  const [busy, setBusy] = useState(false);
  const now = useMemo(() => new Date(), []);

  const model = useMemo(() => buildCertificate({ name, lessons, now }), [name, lessons, now]);

  let reason: string | null = null;
  if (!model.earned) {
    reason = nextTrack
      ? `Locked until you finish a track. ${nextTrack.done} of ${nextTrack.total} ${nextTrack.name} lessons done.`
      : 'Locked until you finish a track.';
  } else if (!model.name) {
    reason = 'Add your name to download it.';
  } else if (load !== 'ready') {
    reason =
      load === 'failed'
        ? 'The preview could not be drawn, so there is nothing to save.'
        : 'Drawing the certificate.';
  }
  const blocked = reason !== null;

  const save = async () => {
    // A blocked button is still reachable (it is aria-disabled, not disabled) so it can say why. Pressing it
    // repeats the reason to assistive technology instead of doing nothing.
    if (reason) {
      announce(reason);
      return;
    }
    const assets = assetsRef.current;
    if (!assets || busy) return;
    setBusy(true);
    try {
      const blob = await renderCertificatePng(model, assets, 2);
      downloadBlob(blob, model.fileName);
      toast.success(`Saved ${model.fileName}`);
    } catch {
      toast.error('The certificate could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.layout}>
      <Panel
        variant="slab"
        size="md"
        padding="lg"
        pattern="tl"
        className={styles.controls}
        contentClassName={styles.controlsBody}
      >
        <p className={styles.intro}>
          A keepsake you make yourself, in this browser, from your own progress. It says on its face that it
          is not a blockchain credential, because it is not one: nobody checks it and it proves nothing about
          you to anyone else.
        </p>

        <TextField
          label="Name on the certificate"
          hint="Stays on this device. Up to 48 characters."
          value={name}
          onValueChange={(v) => onNameChange(v)}
          maxLength={MAX_NAME}
          autoComplete="name"
          spellCheck={false}
          placeholder="Your name"
        />

        <div className={styles.rows}>
          <p className={styles.status} data-earned={model.earned ? 'true' : 'false'}>
            <Glyph name={model.earned ? 'unlock' : 'lock'} size={16} />
            <span>{model.earned ? `Unlocked: ${model.rank}` : 'Locked until you finish a track'}</span>
          </p>
          {!model.earned && nextTrack ? (
            <p className={styles.help}>
              Finish the {nextTrack.name} track ({nextTrack.done} of {nextTrack.total} lessons done) and this
              becomes yours as a {nextTrack.rankName}.
            </p>
          ) : null}
        </div>

        <div className={styles.actions}>
          <span className={styles.download} data-blocked={blocked ? 'true' : undefined}>
            <Button
              variant="primary"
              icon="download"
              loading={busy}
              aria-disabled={blocked ? true : undefined}
              aria-describedby={reason ? reasonId : undefined}
              onClick={() => {
                void save();
              }}
            >
              Download PNG
            </Button>
          </span>
          {reason ? (
            <p className={styles.reason} id={reasonId}>
              {reason}
            </p>
          ) : (
            <p className={styles.reason}>{`3000 by 2000 pixels, saved as ${model.fileName}.`}</p>
          )}
        </div>
      </Panel>

      <figure className={styles.preview}>
        <Preview model={model} onState={setLoad} assetsRef={assetsRef} />
        <figcaption className={styles.caption}>
          {model.earned
            ? 'Preview. The download is this picture at twice the size.'
            : 'Preview of a sample. It is yours once a track is finished.'}
        </figcaption>
      </figure>
    </div>
  );
}
