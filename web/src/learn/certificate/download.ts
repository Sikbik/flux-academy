/** Saves a blob as a file through a temporary link. Browser only. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.append(a);
  a.click();
  a.remove();
  // Give the browser a moment to start the save before the address goes away.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
