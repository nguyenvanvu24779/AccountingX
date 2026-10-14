import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/lib/i18n';
import { BrowserSettings } from './BrowserSettings';

const browserHealth = vi.hoisted(() => vi.fn());
const openUrl = vi.hoisted(() => vi.fn());
vi.mock('@/services', () => ({ browserHealth }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl }));

const fresh = {
  chromeInstalled: false,
  profilesWithExtension: [],
  nativeHost: 'notRegistered',
  browserRuntime: false,
  desktopAppRunning: false,
  ready: false,
};
const ready = {
  chromeInstalled: true,
  profilesWithExtension: ['Nguyen'],
  nativeHost: 'ok',
  browserRuntime: true,
  desktopAppRunning: false,
  ready: true,
};

describe('BrowserSettings guide', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
    browserHealth.mockReset();
    openUrl.mockReset();
  });

  it('walks a brand-new machine through the steps, offering only the current action', async () => {
    browserHealth.mockResolvedValue(fresh);
    render(<BrowserSettings />);

    expect(await screen.findByText('Còn 4 bước để hoàn tất')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tải Chrome' }));
    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining('google.com/chrome'));
    // The extension button waits until Chrome is there.
    expect(screen.queryByRole('button', { name: 'Mở trang cài tiện ích' })).toBeNull();
  });

  it('moves on to the extension once Chrome is installed', async () => {
    browserHealth.mockResolvedValue({ ...fresh, chromeInstalled: true });
    render(<BrowserSettings />);

    expect(await screen.findByText('Còn 3 bước để hoàn tất')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mở trang cài tiện ích' }));
    expect(openUrl).toHaveBeenCalledWith(expect.stringContaining('chromewebstore.google.com'));
  });

  it('says it is ready and explains how to use it', async () => {
    browserHealth.mockResolvedValue(ready);
    render(<BrowserSettings />);

    expect(await screen.findByText('Đã sẵn sàng')).toBeTruthy();
    expect(screen.getByText('Cách dùng')).toBeTruthy();
    expect(screen.getByText(/profile Nguyen/)).toBeTruthy();
  });

  it('warns when the ChatGPT desktop app is open', async () => {
    browserHealth.mockResolvedValue({ ...ready, desktopAppRunning: true });
    render(<BrowserSettings />);

    expect(await screen.findByText(/đang mở. Hãy đóng hẳn/)).toBeTruthy();
  });

  it('shows when it last checked, so pressing Check again visibly does something', async () => {
    browserHealth.mockResolvedValue(ready);
    render(<BrowserSettings />);
    await screen.findByText(/Đã kiểm tra lúc/);

    browserHealth.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra lại|Đang kiểm tra/ }));

    await waitFor(() => expect(browserHealth).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Đã kiểm tra lúc/)).toBeTruthy();
  });
});
