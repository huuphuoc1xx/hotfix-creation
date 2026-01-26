const simpleGit = require('simple-git');
const chalk = require('chalk');
const inquirer = require('inquirer');
const GitHubUtils = require('./utils/github-utils');

class HelmGenerator {
  constructor(options = {}) {
    this.git = simpleGit();
    this.version = options.version; // specific version (e.g., 'v1.23.5' or '1.23.5')
    this.workflowFile = 'helm-chart.yml'; // Fixed workflow file name
    this.githubToken = options.githubToken;
    this.octokit = null;
    this.owner = null;
    this.repo = null;
  }

  async run() {
    try {
      console.log(chalk.cyan('\n╔════════════════════════════════════════════════════════════╗'));
      console.log(chalk.cyan('║         Generate Helm Chart via GitHub Workflow           ║'));
      console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝\n'));

      // Initialize GitHub client
      this.octokit = await GitHubUtils.initOctokit(this.githubToken);

      // Parse repository info
      const repoInfo = await GitHubUtils.parseRepositoryInfo();
      this.owner = repoInfo.owner;
      this.repo = repoInfo.repo;
      console.log(chalk.green(`Repository: ${this.owner}/${this.repo}`));

      // Get current branch
      const status = await this.git.status();
      const currentBranch = status.current;
      console.log(chalk.green(`Current branch: ${currentBranch}`));

      // If version not provided, prompt for it
      let version = this.version;
      if (!version) {
        const { inputVersion } = await inquirer.prompt([
          {
            type: 'input',
            name: 'inputVersion',
            message: 'Enter version (e.g., v1.23.5 or 1.23.5):',
            validate: (input) => {
              if (!input || input.trim() === '') {
                return 'Version is required';
              }
              // Accept both v1.23.5 and 1.23.5 format
              const pattern = /^v?\d+\.\d+\.\d+$/;
              if (!pattern.test(input)) {
                return 'Version must match format: v1.23.5 or 1.23.5';
              }
              return true;
            }
          }
        ]);
        version = inputVersion;
      }

      // Remove 'v' prefix if present
      const helmVersion = version.replace(/^v/, '');
      console.log(chalk.cyan(`\nHelm chart version: ${helmVersion}`));

      // Confirm
      console.log('');
      console.log(chalk.yellow('Summary:'));
      console.log(chalk.gray(`  Workflow: ${this.workflowFile}`));
      console.log(chalk.gray(`  Branch: ${currentBranch}`));
      console.log(chalk.gray(`  Version: ${helmVersion}`));
      console.log('');

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Trigger GitHub workflow to update helm chart?',
          default: false
        }
      ]);

      if (!confirm) {
        console.log(chalk.yellow('\nWorkflow trigger cancelled'));
        return;
      }

      // Trigger GitHub Actions workflow
      console.log(chalk.yellow(`\nTriggering workflow: ${this.workflowFile}...`));
      
      try {
        await this.octokit.actions.createWorkflowDispatch({
          owner: this.owner,
          repo: this.repo,
          workflow_id: this.workflowFile,
          ref: currentBranch,
          inputs: {
            version: helmVersion
          }
        });

        console.log(chalk.green('✓ Workflow triggered successfully!'));

        // Success
        console.log('');
        console.log(chalk.green('════════════════════════════════════════════════════════════'));
        console.log(chalk.green('✓ Helm chart workflow triggered!'));
        console.log(chalk.green('════════════════════════════════════════════════════════════'));
        console.log('');
        console.log(chalk.gray(`Workflow: ${this.workflowFile}`));
        console.log(chalk.gray(`Branch: ${currentBranch}`));
        console.log(chalk.gray(`Version: ${helmVersion}`));
        console.log(chalk.gray(`\nCheck workflow status: https://github.com/${this.owner}/${this.repo}/actions`));
        console.log('');

      } catch (workflowError) {
        if (workflowError.status === 404) {
          console.log('');
          console.log(chalk.red(`✗ Workflow '${this.workflowFile}' not found`));
          console.log('');
          console.log(chalk.yellow('Please make sure:'));
          console.log(chalk.gray(`  1. Workflow file exists: .github/workflows/${this.workflowFile}`));
          console.log(chalk.gray('  2. Workflow has workflow_dispatch trigger'));
          console.log(chalk.gray('  3. Workflow accepts "version" input'));
          console.log('');
          throw new Error(`Workflow ${this.workflowFile} not found`);
        }
        throw workflowError;
      }

    } catch (error) {
      console.error(chalk.red(`\nError: ${error.message}`));
      throw error;
    }
  }
}

module.exports = HelmGenerator;

