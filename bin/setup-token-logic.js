const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { Octokit } = require('@octokit/rest');
const { createOAuthDeviceAuth } = require('@octokit/auth-oauth-device');

class TokenManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.create-hotfix');
    this.tokenFile = path.join(this.configDir, 'github-token');
  }

  async setupToken() {
    console.log(chalk.cyan('\n╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║        GitHub Personal Access Token Setup                 ║'));
    console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝\n'));

    console.log(chalk.yellow('To create a GitHub Personal Access Token:\n'));
    console.log('1. Go to: ' + chalk.blue('https://github.com/settings/tokens'));
    console.log('2. Click "Generate new token" → "Generate new token (classic)"');
    console.log('3. Give it a descriptive name (e.g., "Hotfix Branch Creator")');
    console.log('4. Select scope: ' + chalk.green('✓ repo') + ' (Full control of private repositories)');
    console.log('5. Click "Generate token" at the bottom');
    console.log('6. ' + chalk.red('IMPORTANT:') + ' Copy the token immediately (you won\'t see it again!)\n');

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🚀 Authorize via browser (Recommended - No copy/paste needed!)', value: 'oauth' },
          { name: '📝 I have a token - let me enter it manually', value: 'enter' },
          { name: '🌐 Open GitHub token page in browser', value: 'open' },
          { name: '🔍 Check if I already have a token saved', value: 'check' },
          { name: '❌ Exit', value: 'exit' }
        ]
      }
    ]);

    if (action === 'exit') {
      console.log(chalk.yellow('\nSetup cancelled.'));
      return;
    }

    if (action === 'oauth') {
      await this.authorizeViaOAuth();
      return;
    }

    if (action === 'open') {
      console.log(chalk.green('\nOpening GitHub token page...'));
      const open = require('open');
      await open('https://github.com/settings/tokens/new?description=Hotfix%20Branch%20Creator&scopes=repo');
      console.log(chalk.yellow('\nAfter creating your token, run this command again to save it.\n'));
      return;
    }

    if (action === 'check') {
      await this.showToken();
      return;
    }

    if (action === 'enter') {
      await this.enterAndSaveToken();
    }
  }

  async authorizeViaOAuth() {
    console.log(chalk.cyan('\n╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║        Browser-Based Authorization (OAuth)                ║'));
    console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝\n'));

    console.log(chalk.yellow('This will:'));
    console.log('1. Open GitHub in your browser');
    console.log('2. Ask you to enter a code');
    console.log('3. Authorize the application');
    console.log('4. Automatically save the token\n');

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Ready to proceed?',
        default: true
      }
    ]);

    if (!confirm) {
      console.log(chalk.yellow('\nAuthorization cancelled.'));
      return;
    }

    try {
      console.log(chalk.yellow('\nInitializing OAuth flow...\n'));

      const auth = createOAuthDeviceAuth({
        clientType: 'oauth-app',
        clientId: 'Iv1.b507a08c87ecfe98',
        scopes: ['repo'],
        onVerification: async (verification) => {
          console.log(chalk.green('╔════════════════════════════════════════════════════════════╗'));
          console.log(chalk.green('║                   Authorization Code                      ║'));
          console.log(chalk.green('╚════════════════════════════════════════════════════════════╝\n'));
          console.log(chalk.cyan('  Your code: ') + chalk.bold.yellow(verification.user_code));
          console.log(chalk.gray(`  (Expires in ${Math.floor(verification.expires_in / 60)} minutes)\n`));
          
          console.log(chalk.yellow('Opening GitHub in your browser...'));
          console.log(chalk.gray(`URL: ${verification.verification_uri}\n`));
          
          const open = require('open');
          await open(verification.verification_uri);
          
          console.log(chalk.cyan('Please:'));
          console.log(chalk.white('  1. Enter the code: ') + chalk.bold.yellow(verification.user_code));
          console.log(chalk.white('  2. Click "Authorize"\n'));
          console.log(chalk.gray('Waiting for authorization...'));
        }
      });

      const { token } = await auth({ type: 'oauth' });

      console.log(chalk.green('\n✓ Authorization successful!\n'));

      console.log(chalk.yellow('Verifying token...'));
      const isValid = await this.verifyTokenString(token);

      if (!isValid) {
        console.log(chalk.red('\n✗ Token verification failed. Please try again.'));
        return;
      }

      console.log(chalk.green('✓ Token is valid!\n'));

      const { saveOption } = await inquirer.prompt([
        {
          type: 'list',
          name: 'saveOption',
          message: 'How would you like to save the token?',
          choices: [
            { name: 'Save to file (~/.create-hotfix/github-token) - Recommended', value: 'file' },
            { name: 'Show export command for environment variable', value: 'env' },
            { name: 'Both', value: 'both' },
            { name: 'Don\'t save (I\'ll use --token flag)', value: 'none' }
          ]
        }
      ]);

      if (saveOption === 'file' || saveOption === 'both') {
        await this.saveTokenToFile(token);
      }

      if (saveOption === 'env' || saveOption === 'both') {
        this.showEnvExport(token);
      }

      if (saveOption === 'none') {
        console.log(chalk.yellow('\nToken not saved. Use --token flag when running commands:'));
        console.log(chalk.gray('  cggit pr --qa qa-release-1.0 --token ' + token.substring(0, 10) + '...'));
      }

      console.log(chalk.green('\n✓ Setup complete!\n'));

    } catch (error) {
      if (error.message.includes('access_denied')) {
        console.log(chalk.red('\n✗ Authorization was denied or cancelled.'));
      } else if (error.message.includes('expired')) {
        console.log(chalk.red('\n✗ Authorization code expired. Please try again.'));
      } else {
        console.log(chalk.red(`\n✗ Authorization failed: ${error.message}`));
      }
      console.log(chalk.yellow('\nYou can try again or use manual token entry.\n'));
    }
  }

  async enterAndSaveToken() {
    const { token } = await inquirer.prompt([
      {
        type: 'password',
        name: 'token',
        message: 'Enter your GitHub Personal Access Token:',
        mask: '*',
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return 'Token cannot be empty';
          }
          if (!input.startsWith('ghp_') && !input.startsWith('github_pat_')) {
            return 'Token should start with "ghp_" or "github_pat_"';
          }
          return true;
        }
      }
    ]);

    console.log(chalk.yellow('\nVerifying token...'));
    const isValid = await this.verifyTokenString(token.trim());

    if (!isValid) {
      console.log(chalk.red('\n✗ Token verification failed. Please check your token and try again.'));
      return;
    }

    console.log(chalk.green('✓ Token is valid!\n'));

    const { saveOption } = await inquirer.prompt([
      {
        type: 'list',
        name: 'saveOption',
        message: 'How would you like to save the token?',
        choices: [
          { name: 'Save to file (~/.create-hotfix/github-token) - Recommended', value: 'file' },
          { name: 'Show export command for environment variable', value: 'env' },
          { name: 'Both', value: 'both' },
          { name: 'Don\'t save (I\'ll use --token flag)', value: 'none' }
        ]
      }
    ]);

    if (saveOption === 'file' || saveOption === 'both') {
      await this.saveTokenToFile(token.trim());
    }

    if (saveOption === 'env' || saveOption === 'both') {
      this.showEnvExport(token.trim());
    }

    if (saveOption === 'none') {
      console.log(chalk.yellow('\nToken not saved. Use --token flag when running commands:'));
      console.log(chalk.gray('  cggit pr --qa qa-release-1.0 --token ' + token.substring(0, 10) + '...'));
    }

    console.log(chalk.green('\n✓ Setup complete!\n'));
  }

  async verifyTokenString(token) {
    try {
      const octokit = new Octokit({ auth: token });
      const { data } = await octokit.users.getAuthenticated();
      console.log(chalk.green(`✓ Authenticated as: ${data.login}`));
      return true;
    } catch (error) {
      if (error.status === 401) {
        console.log(chalk.red('✗ Invalid token or token expired'));
      } else {
        console.log(chalk.red(`✗ Verification failed: ${error.message}`));
      }
      return false;
    }
  }

  async verifyToken() {
    console.log(chalk.yellow('\nVerifying GitHub token...\n'));

    let token = process.env.GITHUB_TOKEN;
    let source = 'environment variable';

    if (!token) {
      try {
        token = await this.readTokenFromFile();
        source = 'saved file';
      } catch (error) {
        // File doesn't exist
      }
    }

    if (!token) {
      console.log(chalk.red('✗ No token found.'));
      console.log(chalk.yellow('\nToken not found in:'));
      console.log('  - Environment variable (GITHUB_TOKEN)');
      console.log('  - Saved file (~/.create-hotfix/github-token)');
      console.log(chalk.yellow('\nRun "cggit setup" to set up a token.\n'));
      return;
    }

    console.log(chalk.gray(`Found token in: ${source}`));
    const isValid = await this.verifyTokenString(token);

    if (isValid) {
      console.log(chalk.green('\n✓ Token is valid and ready to use!\n'));
    } else {
      console.log(chalk.red('\n✗ Token is invalid. Please run "cggit setup" again.\n'));
    }
  }

  async showToken() {
    console.log(chalk.yellow('\nChecking for saved token...\n'));

    const envToken = process.env.GITHUB_TOKEN;
    if (envToken) {
      console.log(chalk.green('✓ Found in environment variable (GITHUB_TOKEN)'));
      console.log(chalk.gray(`  Token: ${envToken.substring(0, 10)}...${envToken.substring(envToken.length - 4)}`));
    } else {
      console.log(chalk.gray('✗ Not found in environment variable (GITHUB_TOKEN)'));
    }

    try {
      const fileToken = await this.readTokenFromFile();
      console.log(chalk.green('✓ Found in saved file (~/.create-hotfix/github-token)'));
      console.log(chalk.gray(`  Token: ${fileToken.substring(0, 10)}...${fileToken.substring(fileToken.length - 4)}`));
      
      const { showFull } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'showFull',
          message: 'Show full token?',
          default: false
        }
      ]);

      if (showFull) {
        console.log(chalk.yellow('\nFull token:'));
        console.log(fileToken);
      }
    } catch (error) {
      console.log(chalk.gray('✗ Not found in saved file (~/.create-hotfix/github-token)'));
    }

    console.log('');
  }

  async clearToken() {
    console.log(chalk.yellow('\nClearing saved token...\n'));

    try {
      await fs.unlink(this.tokenFile);
      console.log(chalk.green('✓ Token file deleted successfully'));
      console.log(chalk.gray(`  Removed: ${this.tokenFile}`));
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log(chalk.yellow('No saved token file found'));
      } else {
        throw error;
      }
    }

    if (process.env.GITHUB_TOKEN) {
      console.log(chalk.yellow('\n⚠ Note: GITHUB_TOKEN environment variable is still set'));
      console.log(chalk.gray('  To clear it, run: unset GITHUB_TOKEN'));
    }

    console.log('');
  }

  async saveTokenToFile(token) {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
      await fs.writeFile(this.tokenFile, token, { mode: 0o600 });
      
      console.log(chalk.green('\n✓ Token saved successfully!'));
      console.log(chalk.gray(`  Location: ${this.tokenFile}`));
      console.log(chalk.gray('  The token will be automatically used by cggit commands'));
    } catch (error) {
      console.log(chalk.red(`\n✗ Failed to save token: ${error.message}`));
    }
  }

  async readTokenFromFile() {
    const token = await fs.readFile(this.tokenFile, 'utf-8');
    return token.trim();
  }

  showEnvExport(token) {
    console.log(chalk.green('\n✓ To use as environment variable, run:\n'));
    
    const shell = process.env.SHELL || '';
    
    if (shell.includes('bash') || shell.includes('zsh')) {
      console.log(chalk.cyan('  # Add to ~/.bashrc or ~/.zshrc:'));
      console.log(chalk.white(`  export GITHUB_TOKEN="${token}"`));
      console.log(chalk.cyan('\n  # Or for current session only:'));
      console.log(chalk.white(`  export GITHUB_TOKEN="${token}"`));
    } else if (process.platform === 'win32') {
      console.log(chalk.cyan('  # Windows Command Prompt:'));
      console.log(chalk.white(`  set GITHUB_TOKEN=${token}`));
      console.log(chalk.cyan('\n  # Windows PowerShell:'));
      console.log(chalk.white(`  $env:GITHUB_TOKEN="${token}"`));
    } else {
      console.log(chalk.white(`  export GITHUB_TOKEN="${token}"`));
    }
  }
}

module.exports = async function(options) {
  const tokenManager = new TokenManager();

  if (options.verify) {
    await tokenManager.verifyToken();
  } else if (options.show) {
    await tokenManager.showToken();
  } else if (options.clear) {
    await tokenManager.clearToken();
  } else {
    await tokenManager.setupToken();
  }
};

