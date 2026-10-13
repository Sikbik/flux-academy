import { useNavigate } from 'react-router';
import { LinkButton, type LinkButtonProps } from '@/ui';

export type RouteButtonProps = Omit<LinkButtonProps, 'href'> & { to: string };

/**
 * A button-styled link that navigates inside the app. It is a real anchor (so open in a new tab and copy
 * link work) and a plain left click goes through the router, which plays the hex iris.
 */
export function RouteButton({ to, onClick, ...rest }: RouteButtonProps) {
  const navigate = useNavigate();
  return (
    <LinkButton
      {...rest}
      href={to}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        void navigate(to);
      }}
    />
  );
}
