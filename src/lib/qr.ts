import qrcode from 'qrcode-generator';

/** A horizontal strip of dark modules: `start` column and `length`. */
export interface QrRun {
  start: number;
  length: number;
}

export interface QrMatrix {
  /** Modules per side. */
  size: number;
  /** Dark runs for each row, so a row draws as a few views, not `size`. */
  rows: QrRun[][];
}

export function makeQrMatrix(text: string): QrMatrix {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  const rows: QrRun[][] = [];
  for (let r = 0; r < size; r++) {
    const runs: QrRun[] = [];
    let start = -1;
    for (let c = 0; c <= size; c++) {
      const dark = c < size && qr.isDark(r, c);
      if (dark && start < 0) start = c;
      if (!dark && start >= 0) {
        runs.push({ start, length: c - start });
        start = -1;
      }
    }
    rows.push(runs);
  }
  return { size, rows };
}
