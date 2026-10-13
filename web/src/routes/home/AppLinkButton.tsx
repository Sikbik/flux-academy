import type { MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import { LinkButton, type LinkButtonProps } from '@/ui';

/**
 * The design system's link button, navigating through the router (so the hex iris plays and nothing
 * reloads). Modified clicks (new tab, new window, download) are left to the browser.
 */
export function AppLinkButton({ href, onClick, ...rest }: LinkButtonProps) {
  const navigate = useNavigate();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (/^[a-z][a-z0-9+.-]*:|^\/\//i.test(href)) return;
    e.preventDefault();
    navigate(href);
  };
  return <LinkButton href={href} onClick={handle} {...rest} />;
}
