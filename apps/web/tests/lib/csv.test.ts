import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Column } from '../../src/components/ui';
import { exportRowsToCsv } from '../../src/lib/csv';

interface ReportRow {
  name: string;
  notes: string;
  qty: number;
}

const columns: Column<ReportRow>[] = [
  { key: 'name', header: 'Name' },
  { key: 'notes', header: 'Notes' },
  { key: 'qty', header: 'Qty' },
];

describe('exportRowsToCsv', () => {
  let blobCaptured: Blob | undefined;
  let anchorCaptured: HTMLAnchorElement | undefined;
  let revokeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    blobCaptured = undefined;
    anchorCaptured = undefined;
    revokeSpy = vi.fn();

    const nativeCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName, options) => {
      const element = nativeCreateElement(tagName, options);
      if (tagName.toLowerCase() === 'a') anchorCaptured = element as HTMLAnchorElement;
      return element;
    });

    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => {
        blobCaptured = blob;
        return 'blob:mock';
      },
      revokeObjectURL: revokeSpy,
    });

    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function csvContent(): Promise<string> {
    expect(blobCaptured).toBeDefined();
    return (await blobCaptured!.text()).replace(/^\uFEFF/, '');
  }

  it('builds headers and rows separated by ; with CRLF line endings', async () => {
    exportRowsToCsv({
      filename: 'report',
      columns,
      rows: [
        { name: 'Alice', notes: 'first order', qty: 2 },
        { name: 'Bob', notes: 'second order', qty: 5 },
      ],
    });

    await expect(csvContent()).resolves.toBe(
      '"Name";"Notes";"Qty"\r\n' + '"Alice";"first order";"2"\r\n' + '"Bob";"second order";"5"',
    );
  });

  it('escapes double quotes and fields containing semicolons', async () => {
    exportRowsToCsv({
      filename: 'report',
      columns,
      rows: [{ name: 'Tom "the cat"; MD', notes: 'a;b', qty: 1 }],
    });

    await expect(csvContent()).resolves.toBe('"Name";"Notes";"Qty"\r\n"Tom ""the cat""; MD";"a;b";"1"');
  });

  it('prefixes the content with a UTF-8 BOM', async () => {
    exportRowsToCsv({ filename: 'report', columns, rows: [] });

    expect(blobCaptured).toBeDefined();
    const bytes = new Uint8Array(await blobCaptured!.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('sanitizes the filename and appends the .csv extension', async () => {
    exportRowsToCsv({ filename: 'Customer Report 2026', columns, rows: [] });

    expect(anchorCaptured?.download).toBe('customer-report-2026.csv');
    expect(anchorCaptured?.href).toBe('blob:mock');
    expect(blobCaptured?.type).toBe('text/csv;charset=utf-8');
  });

  it('clicks the download anchor and revokes the object URL', async () => {
    exportRowsToCsv({ filename: 'report', columns, rows: [] });

    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock');
  });
});
