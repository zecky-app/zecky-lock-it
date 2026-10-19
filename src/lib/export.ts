import type { Transaction } from 'react-native-zcash';
import { txKind } from './transactions';
import { formatZec } from './zec';

function cell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const plainZec = (zatoshi: string) => formatZec(zatoshi, 0).replace(/,/g, '');

/** The payment history as CSV text: one row per payment, newest first. */
export function transactionsToCsv(transactions: Transaction[]): string {
  const rows = [
    [
      'Date (UTC)',
      'Type',
      'Amount (ZEC)',
      'Fee (ZEC)',
      'Status',
      'To address',
      'Private note',
      'Block',
      'Transaction ID',
    ],
    ...transactions.map(tx => [
      tx.blockTimeInSeconds > 0
        ? new Date(tx.blockTimeInSeconds * 1000)
            .toISOString()
            .replace('T', ' ')
            .slice(0, 19)
        : '',
      txKind(tx),
      plainZec(tx.value),
      tx.fee == null ? '' : plainZec(tx.fee),
      tx.isExpired ? 'expired' : tx.minedHeight > 0 ? 'confirmed' : 'pending',
      tx.toAddress ?? '',
      tx.memos
        .map(m => m.trim())
        .filter(m => m !== '')
        .join(' | '),
      tx.minedHeight > 0 ? String(tx.minedHeight) : '',
      tx.rawTransactionId,
    ]),
  ];
  return rows.map(row => row.map(cell).join(',')).join('\n');
}
