import { test, Page, chromium, expect } from '@playwright/test';

let tauriPage: Page;

test.beforeAll(async () => {
    const browser = await chromium.connectOverCDP('http://localhost:9222/');
    const context = browser.contexts()[0];
    tauriPage = context.pages()[0];
});

test('can register', async () => {
    await tauriPage.getByRole('button', { name: 'Register' }).click();

    await expect(tauriPage).toHaveURL(/.*register/);

    await tauriPage.getByLabel('Username').fill('test');
    await tauriPage.getByLabel('Email').fill('testuser@test.com');
    await tauriPage.getByLabel('Password').fill('testpassword123');

    await tauriPage.getByRole('button', { name: 'Register' }).click();

    await expect(tauriPage).toHaveURL(/.*choosePath/, { timeout: 25000 });

    await tauriPage.getByRole('img', { name: 'Browse' }).click();
    await tauriPage.getByRole('button', { name: 'ChoosePath' }).click();

    await expect(tauriPage).toHaveURL(/.*mainPage/);
});

test('can logout', async () => {
    await expect(tauriPage).toHaveURL(/.*mainPage/);

    await tauriPage.getByRole('button', { name: 'Settings' }).click();
    await tauriPage.getByRole('button', { name: 'Logout' }).click();

    await expect(tauriPage).toHaveURL(/http:\/\/localhost:1420\//);
});

test('can login', async () => {
    await tauriPage.getByRole('button', { name: 'Login' }).click();

    await expect(tauriPage).toHaveURL(/.*login/);

    await tauriPage.getByLabel('Email').fill('farhad.garaisa@gmail.com');
    await tauriPage.getByLabel('Password').fill('testpassword123');

    await tauriPage.getByRole('button', { name: 'Login' }).click();

    await expect(tauriPage).toHaveURL(/.*mainPage/, { timeout: 15000 });
});

test('can delete account', async () => {
    await expect(tauriPage).toHaveURL(/.*mainPage/);

    await tauriPage.getByRole('button', { name: 'Settings' }).click();
    await tauriPage.getByRole('button', { name: 'DeleteAccount' }).click();

    await tauriPage.getByRole('button', { name: 'ConfirmAccountDeletion' }).click();

    await expect(tauriPage).toHaveURL(/http:\/\/localhost:1420\//);
});
