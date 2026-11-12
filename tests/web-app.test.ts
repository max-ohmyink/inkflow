import { afterEach, describe, expect, it, vi } from 'vitest';
import { studioUrlForTab, viewToTab, stencilFileName } from '../lib/studio-navigation';
import { canDownloadStencil, downloadStencil } from '../lib/stencil-download.web';

const restore = () => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); };
afterEach(restore);

describe('browser-first studio navigation', () => {
  it.each([['designs', 'library'], ['settings', 'settings'], ['create', 'create'], ['arbitrary', 'create'], [undefined, 'create'], [['settings'], 'create']])('validates view %s', (input, output) => {
    expect(viewToTab(input)).toBe(output);
  });
  it('preserves unrelated query/hash values and never returns an external navigation URL', () => {
    const current = new URL('https://example.test/?event=popup&view=settings#studio');
    expect(studioUrlForTab(current, 'library')).toBe('/?event=popup&view=designs#studio');
    expect(studioUrlForTab(current, 'create')).toBe('/?event=popup#studio');
    expect(current.searchParams.get('view')).toBe('settings');
  });
  it('creates safe filenames that clearly identify the mirrored export', () => {
    expect(stencilFileName('Lotus / flower?', 0, 'png')).toBe('Lotus-flower-variation-1-mirrored.png');
    expect(stencilFileName('龍', 3, 'svg')).toBe('tattoo-variation-4-mirrored.svg');
    expect(stencilFileName('a'.repeat(240), 1, 'png').length).toBeLessThan(100);
  });
});

describe('full-resolution browser exports', () => {
  it('downloads the fetched file bytes without resizing or mirroring again and releases the blob URL', async () => {
    vi.useFakeTimers();
    const bytes = new Blob(['original-file-bytes'], { type: 'image/png' });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => bytes });
    vi.stubGlobal('fetch', fetchMock);
    const click = vi.fn(); const remove = vi.fn();
    const link = { href: '', download: '', rel: '', click, remove };
    const appendChild = vi.fn();
    vi.stubGlobal('document', { createElement: vi.fn().mockReturnValue(link), body: { appendChild } });
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stencil-download');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    await downloadStencil('/api/stencils/ready/options/0.png?token=test-capability', 'lotus-mirrored.png');
    expect(canDownloadStencil).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/api/stencils/ready/options/0.png?token=test-capability');
    expect(create).toHaveBeenCalledWith(bytes);
    expect(link.download).toBe('lotus-mirrored.png');
    expect(click).toHaveBeenCalledOnce(); expect(remove).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(revoke).toHaveBeenCalledWith('blob:stencil-download');
  });
  it('does not create a download for an unavailable file', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(downloadStencil('/api/missing', 'stencil.png')).rejects.toThrow('could not be downloaded');
  });
  it('rejects an empty file rather than reporting download success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob([]) }));
    await expect(downloadStencil('/api/empty', 'stencil.svg')).rejects.toThrow('empty');
  });
});
