import { test, Page, chromium, expect } from '@playwright/test';

let tauriPage: Page;

test.beforeAll(async () => {
    const browser = await chromium.connectOverCDP('http://localhost:9222/');
    const context = browser.contexts()[0];
    tauriPage = context.pages()[0];

    // Create a new user before all tests
    await tauriPage.getByRole('button', { name: 'Register' }).click();

    await expect(tauriPage).toHaveURL(/.*register/);

    await tauriPage.getByLabel('Username').fill('farhadgaraisa');
    await tauriPage.getByLabel('Email').fill('farhad.garaisa@gmail.com');
    await tauriPage.getByLabel('Password').fill('testpassword123');

    await tauriPage.getByRole('button', { name: 'Register' }).click();

    await expect(tauriPage).toHaveURL(/.*choosePath/, { timeout: 25000 });

    await tauriPage.getByRole('img', { name: 'Browse' }).click();
    await tauriPage.getByRole('button', { name: 'ChoosePath' }).click();

    await expect(tauriPage).toHaveURL(/.*mainPage/);

    // Create a new file before all tests
    await tauriPage.getByRole('button', { name: 'CreateFile' }).click();

    const nameInput = tauriPage.getByLabel('NodeName');
    await nameInput.fill('File');
    await nameInput.press('Enter');

    await expect(tauriPage.getByLabel('File_file')).toBeVisible();
});

test.afterAll(async () => {
    await expect(tauriPage).toHaveURL(/.*mainPage/);

    const summaryModal = tauriPage.getByLabel("SummaryContent");
    if (await summaryModal.isVisible()) await tauriPage.getByRole('button', { name: 'CloseSummary' }).click();

    // Delete the file after all tests
    await tauriPage.getByLabel('File_file').click({ button: 'right' });

    const deleteOption = tauriPage.getByLabel('Delete');
    await expect(deleteOption).toBeVisible();

    await deleteOption.click();

    // Delete user after all tests
    await tauriPage.getByRole('button', { name: 'Settings' }).click();
    await tauriPage.getByRole('button', { name: 'DeleteAccount' }).click();

    await tauriPage.getByRole('button', { name: 'ConfirmAccountDeletion' }).click();

    await expect(tauriPage).toHaveURL(/http:\/\/localhost:1420\//);
});

test('not enough content for summary', async () => {
    await expect(tauriPage).toHaveURL(/.*mainPage/);

    // Open the file
    await tauriPage.getByLabel('File_file').click();

    // Click on summarize button
    await tauriPage.getByRole('button', { name: 'SummarizeButton' }).click();

    // Find that there is nothing to summarize
    await expect(tauriPage.getByText('Nothing to summarize...')).toBeVisible();
    await tauriPage.getByRole('button', { name: 'CloseSummary' }).click();

    // Close the file
    await tauriPage.getByRole('img', { name: 'File_close' }).click();
});

test('can generate summary', async () => {
    await expect(tauriPage).toHaveURL(/.*mainPage/);

    // Open the file
    await tauriPage.getByLabel('File_file').click();

    // Locate the editor and enter content
    const editor = tauriPage.locator('.milkdown [contenteditable="true"][role="textbox"]');

    await editor.click();
    await editor.fill('The value k is a randomly generated number used to encrypt one ciphertext at a time. This means a different k is used for each plaintext to be encrypted. The receiver knows the matching private key x, so it would be reasonable to assume that they would be able to reverse any encryption process which uses the public key component y. However, the ciphertext is dependent on the one-time key k, which the receiver does not know. This, again, ensures non-repudiation.');

    await tauriPage.waitForTimeout(1000);

    // Click on summarize button
    await tauriPage.getByRole('button', { name: 'SummarizeButton' }).click();

    // Wait for summary to appear
    await expect(tauriPage.getByLabel('SummaryContent')).toBeVisible();
    await tauriPage.waitForTimeout(7000);
    await tauriPage.getByRole('button', { name: 'CloseSummary' }).click();

    // Close the file
    await tauriPage.getByRole('img', { name: 'File_close' }).click();

    // Reopen the file and open summary
    await tauriPage.getByLabel('File_file').click();
    await tauriPage.getByRole('button', { name: 'SummarizeButton' }).click();

    // Ensure that summary was saved
    await expect(tauriPage.getByLabel('SummaryContent')).toBeVisible();
    await tauriPage.getByRole('button', { name: 'CloseSummary' }).click();
});
