/**
 * The certificate: what it says (`text`), where it goes (`layout`) and how it is drawn (`render`).
 * Generated in the browser from local progress. It is not a blockchain credential and says so on itself.
 */
export { downloadBlob } from './download';
export {
  CERT_HEIGHT,
  CERT_WIDTH,
  ellipsize,
  fitSize,
  LOCKUP_ASPECT,
  MAX_TEXT_WIDTH,
  ROWS,
  SAFE_ZONE,
  safeRect,
} from './layout';
export {
  type CertificateAssets,
  COLORS,
  drawCertificate,
  ensureCertificateFonts,
  LOCKUP_URL,
  loadCertificateAssets,
  renderCertificatePng,
} from './render';
export {
  buildCertificate,
  type CertificateInput,
  type CertificateModel,
  type CompletedTrack,
  cleanName,
  completedTracks,
  DISCLAIMER,
  DISCLAIMER_DETAIL,
  EYEBROW,
  EYEBROW_SAMPLE,
  fileSlug,
  formatCertificateDate,
  type LessonRecords,
  MAX_NAME,
  NAME_PLACEHOLDER,
} from './text';
