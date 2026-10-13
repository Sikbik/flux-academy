import { usePrefs } from '@/system/prefs';
import { sfx } from '@/system/sound';
import { toast } from '@/system/toasts';
import { Glyph } from '@/ui';
import styles from './Header.module.css';

/** Sound on or off. Off by default; turning it on plays one confirm blip so the visitor knows. */
export function SoundToggle({ className }: { className?: string }) {
  const on = usePrefs((s) => s.sound);
  return (
    <button
      type="button"
      className={`${styles.iconBtn} ${className ?? ''}`}
      aria-pressed={on}
      aria-label={on ? 'Sound on. Turn sound off' : 'Sound off. Turn sound on'}
      title={on ? 'Sound on' : 'Sound off'}
      data-sound="off"
      onClick={() => {
        const next = !usePrefs.getState().sound;
        usePrefs.getState().set({ sound: next });
        if (next) {
          // The visitor just asked for it: one blip, regardless of the gates.
          sfx.preview();
          toast('Sound on');
        } else {
          toast('Sound off');
        }
      }}
    >
      <Glyph name={on ? 'sound-on' : 'sound-off'} size={18} />
    </button>
  );
}
