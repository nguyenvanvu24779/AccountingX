import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { readTextFile } from '@/services';
import { getErrorMessage } from '@/utils/errorUtils';
import { parseCsv } from './csv';

// Keeps the DOM small for very large exports; the full file stays on disk.
const MAX_ROWS = 2000;

export function CsvView({ filePath }: { filePath: string }) {
  const { t } = useTranslation('explorer');
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setText(null);
    setError(null);
    readTextFile(filePath, { suppressToast: true })
      .then((content) => {
        if (!cancelled) setText(content);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [filePath]);

  const rows = useMemo(() => (text === null ? [] : parseCsv(text)), [text]);

  if (error) return <div className="p-4 text-sm text-destructive">{error}</div>;
  if (text === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  const [header = [], ...body] = rows;
  const shown = body.slice(0, MAX_ROWS);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              {header.map((cell, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: columns have no stable id
                <TableHead key={index} className="whitespace-nowrap">
                  {cell}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((row, rowIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rows have no stable id
              <TableRow key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: cells have no stable id
                  <TableCell key={cellIndex} className="whitespace-nowrap">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="shrink-0 border-t px-3 py-1.5 text-xs text-muted-foreground">
        {body.length > MAX_ROWS
          ? t('csvRowsTruncated', { shown: MAX_ROWS, total: body.length })
          : t('csvRows', { count: body.length })}
      </div>
    </div>
  );
}
