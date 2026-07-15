/* ── Best-effort, fire-and-forget archival (client side) ────────────
 *
 * Sends a bundle (metadata + full report + a viewport thumbnail) of a
 * completed compliance check to the internal Google Drive archive via
 * POST /api/archive. Purely administrative: never awaited by any render
 * path, swallows every error, shows nothing to the user. If it fails for
 * any reason, Tech Verify is completely unaffected.
 */

import type { ComplianceReport } from '../types/rules'

export function archiveReport(report: ComplianceReport, fileName?: string): void {
  try {
    const base = (fileName || 'model').replace(/\.[^.]+$/, '')

    const meta = {
      fileName,
      score: typeof report?.score === 'number' ? report.score : null,
      source: 'Tech Verify web app',
    }

    const files: Array<{ name: string; mimeType: string; content?: string; contentBase64?: string }> = [
      { name: 'analysis.json', mimeType: 'application/json', content: safeJson({ fileName, report }) },
      { name: `${base}.metadata.json`, mimeType: 'application/json', content: safeJson(meta) },
    ]

    const thumb = captureThumbnail()
    if (thumb) files.push({ name: 'thumbnail.webp', mimeType: 'image/webp', contentBase64: thumb })

    void fetch('/api/archive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'Tech Verify',
        uploadId: makeId(),
        timestamp: new Date().toISOString(),
        meta,
        files,
      }),
      keepalive: true,
    }).catch(() => {
      /* best-effort archival — ignore all failures */
    })
  } catch {
    /* archival must never throw into the app */
  }
}

/** Best-effort snapshot of the 3D viewport canvas, downscaled to keep it
 *  small. Returns bare base64 (no data-URL prefix), or null on any issue. */
function captureThumbnail(): string | null {
  try {
    const src =
      (document.querySelector('#viewport canvas') as HTMLCanvasElement | null) ||
      (document.querySelector('canvas') as HTMLCanvasElement | null)
    if (!src || !src.width || !src.height) return null

    const w = 640
    const h = Math.max(1, Math.round((640 * src.height) / src.width))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(src, 0, 0, w, h)
    const url = c.toDataURL('image/webp', 0.72)
    const comma = url.indexOf(',')
    return comma >= 0 ? url.slice(comma + 1) : null
  } catch {
    return null
  }
}

function makeId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    /* fall through */
  }
  return `tv-${Date.now()}-${Math.floor(Math.random() * 1e9).toString(36)}`
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return '{}'
  }
}
