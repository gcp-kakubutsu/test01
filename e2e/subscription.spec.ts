/**
 * E2E Tests for Subscription System
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:9002';

// Mock user credentials for testing
const TEST_USER = {
  email: 'test.subscription@example.com',
  password: 'TestPassword123!',
};

// Helper function to login
async function login(page: Page) {
  await page.goto('/auth/signin');
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
}

// Helper function to wait for subscription data to load
async function waitForSubscriptionLoad(page: Page) {
  await page.waitForSelector('[data-testid="subscription-status"]', { 
    state: 'visible',
    timeout: 10000 
  });
}

test.describe('Subscription System E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start from the main page
    await page.goto('/');
  });

  test.describe('Plan Selection Flow', () => {
    test('should navigate to plans page and select a plan', async ({ page }) => {
      // Login first
      await login(page);
      
      // Navigate to profile page
      await page.goto('/profile');
      await waitForSubscriptionLoad(page);
      
      // Click upgrade button
      await page.click('text=アップグレード');
      
      // Should navigate to plans page
      await page.waitForURL('/subscription/plans');
      await expect(page).toHaveURL(/\/subscription\/plans/);
      
      // Check that plans are displayed
      await expect(page.locator('text=1ヶ月プラン')).toBeVisible();
      await expect(page.locator('text=3ヶ月プラン')).toBeVisible();
      await expect(page.locator('text=6ヶ月プラン')).toBeVisible();
      await expect(page.locator('text=12ヶ月プラン')).toBeVisible();
      
      // Check for popular plan badge
      await expect(page.locator('text=人気No.1')).toBeVisible();
      
      // Check for discount badges
      await expect(page.locator('text=OFF', { hasText: /\d+%OFF/ })).toBeVisible();
    });

    test('should allow plan selection and proceed to billing', async ({ page }) => {
      await login(page);
      await page.goto('/subscription/plans');
      
      // Select the 3-month plan
      const planCard = page.locator('[data-plan-type="3month"]').first();
      await planCard.click();
      
      // Verify plan is selected
      await expect(planCard).toHaveClass(/selected|border-pink-500/);
      
      // Click purchase button
      await page.click('text=購入手続きに進む');
      
      // Should navigate to billing page with plan ID
      await page.waitForURL(/\/subscription\/billing\?planId=/);
      await expect(page).toHaveURL(/planId=/);
    });

    test('should display correct pricing and discounts', async ({ page }) => {
      await page.goto('/subscription/plans');
      
      // Check that longer plans show discounts
      const sixMonthPlan = page.locator('[data-plan-type="6month"]');
      await expect(sixMonthPlan.locator('text=/\d+%OFF/')).toBeVisible();
      
      const twelveMonthPlan = page.locator('[data-plan-type="12month"]');
      await expect(twelveMonthPlan.locator('text=/\d+%OFF/')).toBeVisible();
      
      // Check monthly price calculation
      await expect(page.locator('text=/¥\d+\/月/')).toBeVisible();
    });
  });

  test.describe('Payment Flow', () => {
    test('should display billing page correctly', async ({ page }) => {
      await login(page);
      await page.goto('/subscription/billing?planId=plan_3month');
      
      // Check selected plan information is displayed
      await expect(page.locator('text=3ヶ月プラン')).toBeVisible();
      await expect(page.locator('text=決済手続きに進む')).toBeVisible();
      
      // Check security notice
      await expect(page.locator('text=Transaction Hub により安全に処理されます')).toBeVisible();
    });

    test('should handle payment processing', async ({ page }) => {
      await login(page);
      await page.goto('/subscription/billing?planId=plan_1month');
      
      // Mock the payment initiation
      await page.route('/api/payment/session', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            checkoutUrl: 'https://checkout.example.com/session_123',
            sessionId: 'session_123'
          })
        });
      });
      
      // Click payment button
      await page.click('text=決済手続きに進む');
      
      // Should show loading state
      await expect(page.locator('text=決済処理中')).toBeVisible();
    });

    test('should handle payment success', async ({ page }) => {
      await page.goto('/subscription/success?session_id=session_123');
      
      // Mock successful payment status check
      await page.route('/api/payment/status/*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'completed',
            subscription_id: 'sub_123',
            completed_at: new Date().toISOString()
          })
        });
      });
      
      // Should show success message
      await expect(page.locator('text=お支払い完了')).toBeVisible();
      await expect(page.locator('text=ご購入ありがとうございます')).toBeVisible();
      
      // Should have navigation options
      await expect(page.locator('text=ホームに戻る')).toBeVisible();
      await expect(page.locator('text=サブスクリプション確認')).toBeVisible();
    });

    test('should handle payment failure', async ({ page }) => {
      await page.goto('/subscription/success?session_id=session_failed');
      
      // Mock failed payment status check
      await page.route('/api/payment/status/*', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'failed',
            failure_reason: 'card_declined'
          })
        });
      });
      
      // Should show failure message
      await expect(page.locator('text=お支払い失敗')).toBeVisible();
      await expect(page.locator('text=再試行')).toBeVisible();
    });

    test('should handle payment cancellation', async ({ page }) => {
      await page.goto('/subscription/cancel?session_id=session_canceled');
      
      // Should show cancellation message
      await expect(page.locator('text=お支払いがキャンセルされました')).toBeVisible();
      await expect(page.locator('text=プランを選んで再試行')).toBeVisible();
      await expect(page.locator('text=ホーム')).toBeVisible();
    });
  });

  test.describe('Subscription Management', () => {
    test('should display subscription status in profile', async ({ page }) => {
      await login(page);
      await page.goto('/profile');
      
      // Wait for subscription data to load
      await waitForSubscriptionLoad(page);
      
      // Should show subscription section
      await expect(page.locator('#subscription')).toBeVisible();
      
      // Should show current plan status
      await expect(page.locator('text=/無料プラン|プレミアムプラン/')).toBeVisible();
    });

    test('should navigate to subscription management', async ({ page }) => {
      await login(page);
      await page.goto('/profile');
      await waitForSubscriptionLoad(page);
      
      // Click manage subscription button if premium user
      const manageButton = page.locator('text=管理');
      if (await manageButton.isVisible()) {
        await manageButton.click();
        await expect(page).toHaveURL('/subscription');
      }
    });

    test('should handle subscription cancellation', async ({ page }) => {
      // This test assumes user has an active subscription
      await login(page);
      await page.goto('/subscription');
      
      // Mock active subscription
      await page.route('/api/subscription/status', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'active',
            planType: '1month',
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            autoRenew: true
          })
        });
      });
      
      await page.reload();
      
      // Look for cancel option
      const cancelButton = page.locator('text=/キャンセル|解約/');
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
        
        // Should show confirmation dialog
        await expect(page.locator('text=解約の確認')).toBeVisible();
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      await login(page);
      
      // Simulate network error
      await page.route('/api/subscription/**', route => {
        route.abort('failed');
      });
      
      await page.goto('/subscription/plans');
      
      // Should show error message
      await expect(page.locator('text=/エラー|接続に失敗/')).toBeVisible();
      await expect(page.locator('text=再試行')).toBeVisible();
    });

    test('should show loading states appropriately', async ({ page }) => {
      await login(page);
      
      // Add delay to API calls to test loading states
      await page.route('/api/subscription/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        route.continue();
      });
      
      await page.goto('/profile');
      
      // Should show loading indicator
      await expect(page.locator('[data-testid="subscription-loading"]')).toBeVisible();
    });

    test('should handle authentication errors', async ({ page }) => {
      // Access subscription page without login
      await page.goto('/subscription/plans');
      
      // Should redirect to login
      await page.waitForURL('/auth/signin');
      await expect(page).toHaveURL(/\/auth\/signin/);
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile devices', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await login(page);
      await page.goto('/subscription/plans');
      
      // Plans should be stacked on mobile
      const planGrid = page.locator('[data-testid="plans-grid"]');
      await expect(planGrid).toHaveCSS('display', 'grid');
      
      // All plan cards should be visible
      await expect(page.locator('text=1ヶ月プラン')).toBeVisible();
      await expect(page.locator('text=3ヶ月プラン')).toBeVisible();
    });

    test('should work on tablet devices', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      
      await login(page);
      await page.goto('/subscription/plans');
      
      // Should show 2 columns on tablet
      const planCards = page.locator('[data-testid="plan-card"]');
      const firstCard = planCards.first();
      const secondCard = planCards.nth(1);
      
      const firstCardBox = await firstCard.boundingBox();
      const secondCardBox = await secondCard.boundingBox();
      
      // Cards should be side by side
      expect(firstCardBox?.y).toEqual(secondCardBox?.y);
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      await login(page);
      await page.goto('/subscription/plans');
      
      // Check for accessibility attributes
      await expect(page.locator('[aria-label*="プラン選択"]')).toBeVisible();
      await expect(page.locator('[role="button"]')).toHaveCount(5); // 4 plans + 1 purchase button
    });

    test('should be keyboard navigable', async ({ page }) => {
      await login(page);
      await page.goto('/subscription/plans');
      
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should be able to select plans with keyboard
      const focusedElement = await page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    });

    test('should have proper color contrast', async ({ page }) => {
      await login(page);
      await page.goto('/subscription/plans');
      
      // This would require more sophisticated color contrast checking
      // For now, just ensure important elements are visible
      await expect(page.locator('text=プラン選択')).toBeVisible();
      await expect(page.locator('[class*="text-"]')).toHaveCount.greaterThan(0);
    });
  });
});