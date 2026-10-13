import { useEffect, useLayoutEffect } from 'react';

/** `useLayoutEffect` that does not warn where there is no DOM. */
export const useIsoLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;
