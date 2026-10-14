import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/lib/i18n';
import { SystemCheckSettings } from './SystemCheckSettings';

const systemCheck = vi.hoisted(() => vi.fn());
const systemRepair = vi.hoisted(() => vi.fn());
vi.mock('@/services', () => ({ systemCheck, systemRepair }));

const item = (id: string, group: string, status: string, extra: object = {}) => ({
  id,
  group,
  status,
  detail: null,
  autoFixable: false,
  ...extra,
});

describe('SystemCheckSettings', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
    systemCheck.mockReset();
    systemRepair.mockReset();
  });

  it('explains each problem in words and says what to do', async () => {
    systemCheck.mockResolvedValue({
      overall: 'fail',
      checks: [
        item('codex.login', 'codex', 'fail'),
        item('zalo.node', 'zalo', 'warn'),
        item('company', 'machine', 'ok', { detail: '1' }),
      ],
    });
    render(<SystemCheckSettings />);

    expect(await screen.findByText('Có mục cần xử lý để AccountingX chạy được')).toBeTruthy();
    expect(screen.getByText('Đăng nhập tài khoản ChatGPT')).toBeTruthy();
    expect(screen.getByText(/Chưa đăng nhập ChatGPT/)).toBeTruthy();
    expect(screen.getByText(/Cài Node.js bản LTS/)).toBeTruthy();
    // Nothing to mend automatically here.
    expect(screen.queryByRole('button', { name: 'Sửa tự động' })).toBeNull();
  });

  it('offers a one-press repair when the app can fix something, then checks again', async () => {
    systemCheck
      .mockResolvedValueOnce({
        overall: 'warn',
        checks: [item('skills', 'codex', 'warn', { detail: 'accountingx-misa-ton-kho', autoFixable: true })],
      })
      .mockResolvedValueOnce({ overall: 'ok', checks: [item('skills', 'codex', 'ok')] });
    systemRepair.mockResolvedValue({ repaired: true });
    render(<SystemCheckSettings />);

    fireEvent.click(await screen.findByRole('button', { name: 'Sửa tự động' }));

    await waitFor(() => expect(systemRepair).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Mọi thứ đều sẵn sàng')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Sửa tự động' })).toBeNull();
  });

  it('sends people to the screen that fixes a Zalo or browser problem', async () => {
    systemCheck.mockResolvedValue({
      overall: 'warn',
      checks: [item('zalo.connection', 'zalo', 'warn')],
    });
    const onNavigate = vi.fn();
    render(<SystemCheckSettings onNavigate={onNavigate} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Mở màn hình xử lý' }));
    expect(onNavigate).toHaveBeenCalledWith('zalo');
  });
});
