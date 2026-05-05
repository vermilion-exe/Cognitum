import { test, Page, chromium, expect } from '@playwright/test';

let tauriPage: Page;

test.beforeAll(async () => {
    const browser = await chromium.connectOverCDP('http://localhost:9222/');
    const context = browser.contexts()[0];
    tauriPage = context.pages()[0];

    // Create a new user before all tests
    await tauriPage.getByRole('button', { name: 'Register' }).click();

    await expect(tauriPage).toHaveURL(/.*register/);

    await tauriPage.getByLabel('Username').fill('test');
    await tauriPage.getByLabel('Email').fill('testuser@test.com');
    await tauriPage.getByLabel('Password').fill('Testpassword123');

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

    const explanationModal = tauriPage.getByLabel("ExplanationContent");
    if (await explanationModal.isVisible()) await tauriPage.getByRole('button', { name: 'CloseExplanation' }).click();

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

test('can explain text', async () => {
    await expect(tauriPage).toHaveURL(/.*mainPage/);

    // Open an existing file
    await tauriPage.getByLabel('File_file').click();

    // Locate the editor and enter text
    let editor = tauriPage.locator('.milkdown [contenteditable="true"][role="textbox"]');

    // Enter some content
    await editor.click();
    await editor.pressSequentially('Explain the laws of thermodynamics.');

    await expect(tauriPage.getByText('Explain the laws of thermodynamics.')).toBeVisible();

    // Select the text and press explain button
    await editor.selectText();

    await tauriPage.getByRole('button', { name: 'ExplainText' }).click();

    // Find and open explanation
    let explanation = tauriPage.locator('.highlight-explanation');
    await explanation.click({ timeout: 120000 });

    // Ensure content exists
    await expect(tauriPage.getByLabel('ExplanationContent')).toBeVisible();

    // Close explanation
    await tauriPage.getByRole('button', { name: 'CloseExplanation' }).click();

    // Close the file
    await tauriPage.getByRole('img', { name: 'File_close' }).click();

    // Reopen the file and open summary
    await tauriPage.getByLabel('File_file').click();

    // Open the explanation
    explanation = tauriPage.locator('.highlight-explanation');
    await explanation.click();

    // Ensure that highlight was saved
    await expect(tauriPage.getByLabel('ExplanationContent')).toBeVisible();

    // Close explanation
    await tauriPage.getByRole('button', { name: 'CloseExplanation' }).click();
});
