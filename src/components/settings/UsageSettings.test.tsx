import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n } from '@/lib/i18n';
import { UsageSettings } from './UsageSettings';

const getAccountRateLimits = vi.hoisted(() => vi.fn());
vi.mock('@/services', () => ({ getAccountRateLimits }));

const snapshot = {
  rateLimits: {
    planType: 'plus',
    primary: { usedPercent: 10, windowDurationMins: 300, resetsAt: 1791980005 },
    secondary: { usedPercent: 2, windowDurationMins: 10080, resetsAt: 1792566805 },
    credits: { balance: '0', hasCredits: false, unlimited: false },
    rateLimitReachedType: null,
  },
  rateLimitResetCredits: { availableCount: 2 },
};

describe('UsageSettings', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('vi');
    getAccountRateLimits.mockReset();
  });

  it('shows the plan, both limit windows and the remaining limit resets in Vietnamese', async () => {
    getAccountRateLimits.mockResolvedValue(snapshot);
    render(<UsageSettings />);

    expect(await screen.findByText('Mỗi 5 giờ')).toBeTruthy();
    expect(screen.getByText('Đã dùng 10%')).toBeTruthy();
    expect(screen.getByText('Đã dùng 2%')).toBeTruthy();
    expect(screen.getByText('plus')).toBeTruthy();
    expect(screen.getByText('Lượt đặt lại giới hạn còn lại')).toBeTruthy();
    expect(screen.queryByText('Số dư tín dụng')).toBeNull();
  });

  it('says so when the limit was reached', async () => {
    getAccountRateLimits.mockResolvedValue({
      ...snapshot,
      rateLimits: { ...snapshot.rateLimits, rateLimitReachedType: 'primary' },
    });
    render(<UsageSettings />);

    expect(await screen.findByText(/Đã chạm giới hạn/)).toBeTruthy();
  });
});
