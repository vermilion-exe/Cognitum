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

    const flashcardModal = tauriPage.getByLabel("FlashcardContent");
    if (await flashcardModal.isVisible()) await tauriPage.getByRole('button', { name: 'CloseFlashcards' }).click();

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

test('not enought content for flashcards', async () => {
    await expect(tauriPage).toHaveURL(/.*mainPage/);

    // Open the file
    await tauriPage.getByLabel('File_file').click();

    await tauriPage.getByRole('button', { name: 'ReviseButton' }).click();

    await expect(tauriPage.getByText('Revision for this note is complete!')).toBeVisible();

    await tauriPage.getByRole('button', { name: 'CloseFlashcards' }).click();

    // Close the file
    await tauriPage.getByRole('img', { name: 'File_close' }).click();
});

test('can revise flashcards', async () => {
    await expect(tauriPage).toHaveURL(/.*mainPage/);

    // Open the file
    await tauriPage.getByLabel('File_file').click();

    await tauriPage.waitForTimeout(500);

    // Locate the editor and enter content
    const editor = tauriPage.locator('.milkdown [contenteditable="true"][role="textbox"]');

    await editor.click();
    await editor.fill('The value k is a randomly generated number used to encrypt one ciphertext at a time. This means a different k is used for each plaintext to be encrypted. The receiver knows the matching private key x, so it would be reasonable to assume that they would be able to reverse any encryption process which uses the public key component y. However, the ciphertext is dependent on the one-time key k, which the receiver does not know. This, again, ensures non-repudiation.');

    await tauriPage.waitForTimeout(500);

    await tauriPage.getByRole('button', { name: 'ReviseButton' }).click();

    let content = tauriPage.getByLabel('FlashcardContent');
    await expect(content).toBeVisible({ timeout: 0 });

    const question = tauriPage.getByLabel('FlashcardQuestion');
    const questionContent = await question.textContent();

    await tauriPage.getByRole('button', { name: 'RevealAnswer' }).click();

    await tauriPage.getByRole('button', { name: 'Normal' }).click();

    await expect(question).not.toHaveText(questionContent!);

    await tauriPage.getByRole('button', { name: 'CloseFlashcards' }).click();

    // Close the file
    await tauriPage.getByRole('img', { name: 'File_close' }).click();

    // Reopen the file
    await tauriPage.getByLabel('File_file').click();

    await tauriPage.waitForTimeout(1000);

    await tauriPage.getByRole('button', { name: 'ReviseButton' }).click();
    content = tauriPage.getByLabel('FlashcardContent');
    await expect(content).toBeVisible();

    await tauriPage.getByRole('button', { name: 'CloseFlashcards' }).click();

    // Close the file
    await tauriPage.getByRole('img', { name: 'File_close' }).click();
});

test('can replace stale flashcards', async () => {
    await expect(tauriPage).toHaveURL(/.*mainPage/);

    // Open the file
    await tauriPage.getByLabel('File_file').click();

    await tauriPage.waitForTimeout(500);

    // Locate the editor and replace content
    const editor = tauriPage.locator('.milkdown [contenteditable="true"][role="textbox"]');

    await editor.click();
    await editor.selectText();
    await tauriPage.keyboard.press('Backspace');

    await editor.fill('Better implementation of array lists is a list where there is an internal array that contains the array list and some free space in case any elements need to be added. Thus, the internal array will have size larger than the element count, so that it can accommodate addition of new elements. We would perform any read/write operations directly on the internal array. To perform an operation that changes the size, we do not create a new internal array, but rather work on the existing one and change the count value. We would also need to resize the internal array if the count reaches its length.');

    await tauriPage.waitForTimeout(500);

    await tauriPage.getByRole('button', { name: 'ReviseButton' }).click();

    const question = tauriPage.getByLabel('FlashcardQuestion');
    const questionContent = await question.textContent();

    await expect(tauriPage.getByLabel('StaleWarning')).toBeVisible({ timeout: 0 });

    await tauriPage.getByRole('button', { name: 'ReplaceStaleFlashcards' }).click();

    await expect(question).not.toHaveText(questionContent!, { timeout: 0 });

    await tauriPage.getByRole('button', { name: 'CloseFlashcards' }).click();
});
