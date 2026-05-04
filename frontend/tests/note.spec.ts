import { test, Page, chromium, expect } from '@playwright/test';

let tauriPage: Page;

test.beforeAll(async () => {
    const browser = await chromium.connectOverCDP('http://localhost:9222/');
    const context = browser.contexts()[0];
    tauriPage = context.pages()[0];

    // Create user before running tests
    await tauriPage.getByRole('button', { name: 'Register' }).click();

    await expect(tauriPage).toHaveURL(/.*register/);

    await tauriPage.getByLabel('Username').fill('test');
    await tauriPage.getByLabel('Email').fill('testuser@gmail.com');
    await tauriPage.getByLabel('Password').fill('testpassword123');

    await tauriPage.getByRole('button', { name: 'Register' }).click();

    await expect(tauriPage).toHaveURL(/.*choosePath/, { timeout: 25000 });

    await tauriPage.getByRole('img', { name: 'Browse' }).click();
    await tauriPage.getByRole('button', { name: 'ChoosePath' }).click();
});

test.afterAll(async () => {
    await expect(tauriPage).toHaveURL(/.*mainPage/);

    // Delete the user after all tests
    await tauriPage.getByRole('button', { name: 'Settings' }).click();
    await tauriPage.getByRole('button', { name: 'DeleteAccount' }).click();

    await tauriPage.getByRole('button', { name: 'ConfirmAccountDeletion' }).click();

    await expect(tauriPage).toHaveURL(/http:\/\/localhost:1420\//);
});

test('can create directory via explorer', async () => {
    await expect(tauriPage).toHaveURL(/.*mainPage/);

    // Click the create directory button in the explorer
    await tauriPage.getByRole('button', { name: 'CreateDirectory' }).click();

    // Enter a name for new directory
    const nameInput = tauriPage.getByLabel('NodeName');
    await nameInput.fill('Directory');
    await nameInput.press('Enter');

    // Find the directory in the explorer tree
    await expect(tauriPage.getByLabel('Directory_dir')).toBeVisible();
});

test('can create file via explorer', async () => {
    await expect(tauriPage).toHaveURL(/.*mainPage/);

    // Click the create file button in the explorer
    await tauriPage.getByRole('button', { name: 'CreateFile' }).click();

    // Enter a name for new file
    const nameInput = tauriPage.getByLabel('NodeName');
    await nameInput.fill('File');
    await nameInput.press('Enter');

    // Find the file in the explorer tree
    await expect(tauriPage.getByLabel('File_file')).toBeVisible();
});

test('can create file via button', async () => {
    await expect(tauriPage).toHaveURL(/.*mainPage/);

    // Click the create file button in the main menu
    await tauriPage.getByRole('button', { name: 'CreateNewFileButton' }).click();

    // Enter a name for new file and submit
    await tauriPage.getByLabel('FileName').fill("File2");
    await tauriPage.getByRole('button', { name: 'SubmitCreateFile' }).click();

    // Find the file in the explorer tree
    await expect(tauriPage.getByLabel('File2_file')).toBeVisible();
});

test('can create directory via context options', async () => {
    await expect(tauriPage).toHaveURL(/.*mainPage/);

    // Right click on an existing directory
    await tauriPage.getByLabel('Directory_dir').click();
    await tauriPage.getByLabel('Directory_dir').click({ button: 'right' });

    // Click on the New Folder option
    const newFolderOption = tauriPage.getByLabel('New Folder');
    await expect(newFolderOption).toBeVisible();

    await newFolderOption.click();

    // Find the new directory inside original directory
    await expect(tauriPage.getByLabel('Untitled_dir')).toBeVisible();
});

test('can create file via context options', async () => {
    await expect(tauriPage).toHaveURL(/.*mainPage/);

    // Right click on an existing directory
    await tauriPage.getByLabel('Directory_dir').click({ button: 'right' });

    // Click on the New File option
    const newFileOption = tauriPage.getByLabel('New File');
    await expect(newFileOption).toBeVisible();

    await newFileOption.click();

    // Find the new file inside directory
    await expect(tauriPage.getByLabel('Untitled_file')).toBeVisible();
});

test('can edit notes', async () => {
    await expect(tauriPage).toHaveURL(/.*mainPage/);

    // Open an existing file
    await tauriPage.getByLabel('File_file').click();

    // Locate the editor and enter text
    const editor = tauriPage.locator('.milkdown [contenteditable="true"][role="textbox"]');

    await editor.click();
    await editor.pressSequentially('Note content');

    await expect(tauriPage.getByText('Note Content')).toBeVisible();

    await tauriPage.waitForTimeout(500);

    // Close the file for autosave
    await tauriPage.getByRole('img', { name: 'File_close' }).click();

    // Reopen the file to check contents
    await tauriPage.getByLabel('File_file').click();

    // Ensure that content was saved
    await expect(tauriPage.getByText('Note Content')).toBeVisible();
});

test('can remove nodes via context options', async () => {
    await expect(tauriPage).toHaveURL(/.*mainPage/);

    // Right click on the directory
    await tauriPage.getByLabel('Directory_dir').click({ button: 'right' });

    // Choose delete option from context menu
    let deleteOption = tauriPage.getByLabel('Delete');
    await expect(deleteOption).toBeVisible();

    await deleteOption.click();

    await expect(tauriPage.getByLabel('Directory_dir')).not.toBeVisible();

    await tauriPage.getByLabel('File_file').click({ button: 'right' });

    deleteOption = tauriPage.getByLabel('Delete');
    await expect(deleteOption).toBeVisible();

    await deleteOption.click();

    await expect(tauriPage.getByLabel('File_file')).not.toBeVisible();

    await tauriPage.getByLabel('File2_file').click({ button: 'right' });

    deleteOption = tauriPage.getByLabel('Delete');
    await expect(deleteOption).toBeVisible();

    await deleteOption.click();

    await expect(tauriPage.getByLabel('File2_file')).not.toBeVisible();
});
