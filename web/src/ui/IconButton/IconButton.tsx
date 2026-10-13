import type { ReactNode } from 'react';
import { ButtonBase, type ButtonProps } from '../Button/Button';
import type { GlyphName } from '../Glyph/glyphs';
import type { Placement } from '../internal/position';
import { Tooltip } from '../Tooltip/Tooltip';

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'icon' | 'iconEnd' | 'fullWidth'> {
  /** The glyph. */
  icon: GlyphName;
  /** The accessible name. Required: there is no visible text. */
  label: string;
  /** `chamfer` (default) or `hex`, the cell. */
  shape?: 'chamfer' | 'hex';
  /** A tooltip with the label on hover and focus. Default true; pass a node to say more. */
  tooltip?: boolean | ReactNode;
  /** A hotkey shown in the tooltip, for example "mod+k". */
  shortcut?: string;
  tooltipPlacement?: Placement;
}

/**
 * A square (or hex) button that holds one glyph. The accessible name is required and doubles
 * as the tooltip. Same states and focus beam as Button.
 *
 *   <IconButton icon="copy" label="Copy JSON" shortcut="mod+shift+c" onClick={copy} />
 */
export function IconButton({
  ref,
  icon,
  label,
  shape = 'chamfer',
  tooltip = true,
  shortcut,
  tooltipPlacement,
  variant = 'secondary',
  size,
  tone,
  magnetic,
  loading,
  className,
  ...rest
}: IconButtonProps) {
  const button = (
    <ButtonBase
      Tag="button"
      variant={variant}
      tone={tone}
      size={size}
      icon={icon}
      iconOnly
      shape={shape}
      magnetic={magnetic ?? false}
      loading={loading}
      className={className}
      forwardedRef={ref as never}
      rest={{ ...rest, 'aria-label': label }}
    />
  );
  if (tooltip === false) return button;
  return (
    <Tooltip content={tooltip === true ? label : tooltip} shortcut={shortcut} placement={tooltipPlacement}>
      {button}
    </Tooltip>
  );
}
