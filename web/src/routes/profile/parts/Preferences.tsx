import { useId } from 'react';
import {
  ACCENTS,
  type AccentId,
  isAccentUnlocked,
  type MotionPref,
  type QualityPref,
  type TrackCompletion,
  unlockRule,
  usePrefs,
} from '@/system/prefs';
import { Glyph, Panel, SegmentedControl, Switch, useReducedMotion } from '@/ui';
import styles from './Preferences.module.css';

const ACCENT_NAME: Record<AccentId, string> = {
  flux: 'Flux blue',
  cumulus: 'Cumulus',
  nimbus: 'Nimbus',
  stratus: 'Stratus',
};

export interface PreferencesProps {
  completion: TrackCompletion;
}

/** One preference: a label, the control, and a line that says what it does. */
function Field({
  label,
  note,
  children,
  id,
}: {
  label: string;
  note: string;
  children: React.ReactNode;
  id: string;
}) {
  return (
    <div className={styles.field}>
      <div className={styles.fieldText}>
        <p className={styles.fieldLabel} id={id}>
          {label}
        </p>
        <p className={styles.fieldNote}>{note}</p>
      </div>
      <div className={styles.control}>{children}</div>
    </div>
  );
}

/**
 * The preferences the site keeps for you, all through `system/prefs`: accent, sound, motion, quality and
 * ambient mode. A change applies at once and is saved in this browser.
 */
export function Preferences({ completion }: PreferencesProps) {
  const uid = useId();
  const accent = usePrefs((s) => s.accent);
  const sound = usePrefs((s) => s.sound);
  const motion = usePrefs((s) => s.motion);
  const quality = usePrefs((s) => s.quality);
  const ambient = usePrefs((s) => s.ambient);
  const set = usePrefs((s) => s.set);
  const setAccent = usePrefs((s) => s.setAccent);
  const calm = useReducedMotion();

  // A stored accent that is locked is not applied (the page falls back to Flux blue): show what applies.
  const shown: AccentId = isAccentUnlocked(accent, completion) ? accent : 'flux';

  return (
    <Panel
      variant="slab"
      size="md"
      padding="lg"
      pattern="tr"
      className={styles.panel}
      contentClassName={styles.body}
    >
      <fieldset className={styles.accent}>
        <legend className={styles.fieldLabel}>Accent colour</legend>
        <p className={styles.fieldNote}>
          Tints buttons, focus and highlights across the site. Each tier colour is a reward for finishing that
          track.
        </p>
        <div className={styles.options}>
          {ACCENTS.map((a) => {
            const open = isAccentUnlocked(a, completion);
            return (
              <label
                key={a}
                className={styles.option}
                data-locked={open ? undefined : 'true'}
                data-checked={shown === a ? 'true' : undefined}
              >
                <input
                  type="radio"
                  name={`${uid}-accent`}
                  value={a}
                  checked={shown === a}
                  disabled={!open}
                  onChange={() => {
                    setAccent(a);
                  }}
                />
                <span className={styles.swatch} data-accent={a} aria-hidden="true" />
                <span className={styles.optionText}>
                  <span className={styles.optionName}>
                    {ACCENT_NAME[a]}
                    {open ? null : <Glyph name="lock" size={13} />}
                  </span>
                  <span className={styles.optionRule}>
                    {open ? (a === 'flux' ? 'Always available' : 'Unlocked') : unlockRule(a)}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Field
        id={`${uid}-sound`}
        label="Sound"
        note="Short interface sounds when you finish a step or earn something. Off until you turn it on, and it never plays on its own."
      >
        <Switch
          size="md"
          checked={sound}
          onCheckedChange={(v) => set({ sound: v })}
          aria-labelledby={`${uid}-sound`}
        >
          {sound ? 'On' : 'Off'}
        </Switch>
      </Field>

      <Field
        id={`${uid}-motion`}
        label="Motion"
        note={
          motion === 'system'
            ? `Following your device: motion is ${calm ? 'reduced' : 'on'} right now. Reduced removes travel, parallax and looping animation; everything still works.`
            : motion === 'reduced'
              ? 'Reduced: no travel, parallax or looping animation, whatever your device says.'
              : 'Full: all motion plays, even if your device asks for less.'
        }
      >
        <SegmentedControl
          aria-label="Motion"
          size="sm"
          value={motion}
          onValueChange={(v) => set({ motion: v as MotionPref })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'reduced', label: 'Reduced' },
            { value: 'full', label: 'Full' },
          ]}
        />
      </Field>

      <Field
        id={`${uid}-quality`}
        label="Graphics quality"
        note="Auto picks a level from how smoothly the page runs on your device and backs off when it struggles. Lower levels draw less in the background scenes."
      >
        <SegmentedControl
          aria-label="Graphics quality"
          size="sm"
          value={quality}
          onValueChange={(v) => set({ quality: v as QualityPref })}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
        />
      </Field>

      <Field
        id={`${uid}-ambient`}
        label="Ambient mode"
        note="After two minutes with no input the page shows a slow view of the network scene, with a few facts. Any key or movement brings the page back."
      >
        <Switch
          size="md"
          checked={ambient}
          onCheckedChange={(v) => set({ ambient: v })}
          aria-labelledby={`${uid}-ambient`}
        >
          {ambient ? 'On' : 'Off'}
        </Switch>
      </Field>
    </Panel>
  );
}
