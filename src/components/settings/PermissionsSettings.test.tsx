import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/lib/i18n';
import { PermissionsSettings } from './PermissionsSettings';

const getPermissionMode = vi.hoisted(() => vi.fn());
const setPermissionMode = vi.hoisted(() => vi.fn());
vi.mock('@/services', () => ({ getPermissionMode, setPermissionMode }));

describe('PermissionsSettings', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
    getPermissionMode.mockReset();
    setPermissionMode.mockReset();
  });

  it('starts on asking and turns automatic permission on when switched', async () => {
    getPermissionMode.mockResolvedValue({ mode: 'ask' });
    setPermissionMode.mockResolvedValue(undefined);
    render(<PermissionsSettings />);

    const toggle = await screen.findByRole('switch');
    await waitFor(() => expect(toggle.getAttribute('data-state')).toBe('unchecked'));
    fireEvent.click(toggle);

    await waitFor(() => expect(setPermissionMode).toHaveBeenCalledWith('auto'));
    await waitFor(() => expect(toggle.getAttribute('data-state')).toBe('checked'));
  });

  it('puts the switch back and says so when saving fails', async () => {
    getPermissionMode.mockResolvedValue({ mode: 'ask' });
    setPermissionMode.mockRejectedValue(new Error('boom'));
    render(<PermissionsSettings />);

    const toggle = await screen.findByRole('switch');
    await waitFor(() => expect(toggle.getAttribute('data-state')).toBe('unchecked'));
    fireEvent.click(toggle);

    expect(await screen.findByText(/Không lưu được cài đặt/)).toBeTruthy();
    expect(toggle.getAttribute('data-state')).toBe('unchecked');
  });

  it('keeps the approval ticket rule in view', async () => {
    getPermissionMode.mockResolvedValue({ mode: 'auto' });
    render(<PermissionsSettings />);

    expect(await screen.findByText(/vẫn phải qua phiếu duyệt/)).toBeTruthy();
  });
});
