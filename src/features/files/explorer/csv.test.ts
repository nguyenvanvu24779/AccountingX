import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('keeps commas inside quoted fields, such as MISA numbers like "12,00"', () => {
    expect(parseCsv('Kho,Số lượng\nKHO A,"3.000,00"')).toEqual([
      ['Kho', 'Số lượng'],
      ['KHO A', '3.000,00'],
    ]);
  });

  it('handles doubled quotes, empty fields, CRLF and a BOM', () => {
    expect(parseCsv('﻿a,b,c\r\n"x ""y""",,z\r\n')).toEqual([
      ['a', 'b', 'c'],
      ['x "y"', '', 'z'],
    ]);
  });

  it('keeps line breaks inside quoted fields and a final row without a newline', () => {
    expect(parseCsv('a,"l1\nl2"\nb,c')).toEqual([
      ['a', 'l1\nl2'],
      ['b', 'c'],
    ]);
  });

  it('returns no rows for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });
});
