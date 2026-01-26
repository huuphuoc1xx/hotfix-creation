#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');

const program = new Command();

program
  .name('cggit')
  .description('Complete Git workflow tool for hotfix branches and PRs')
  .version('1.0.0');

// Setup token command
program
  .command('setup')
  .description('Setup GitHub personal access token')
  .option('--verify', 'Verify existing token')
  .option('--show', 'Show current token')
  .option('--clear', 'Clear saved token')
  .action(async (options) => {
    try {
      // Import and run setup-token logic
      const setupToken = require('./setup-token-logic');
      await setupToken(options);
    } catch (error) {
      console.error(chalk.red(`\nError: ${error.message}`));
      process.exit(1);
    }
  });

// Create hotfix branches command
program
  .command('hotfix')
  .description('Create hotfix branches for QA and/or UAT')
  .option('--qa <branch>', 'QA base branch name (e.g., qa-release-1.0)')
  .option('--uat <branch>', 'UAT base branch name (e.g., uat-release-1.0)')
  .option('-n, --no-push', 'Create branches but don\'t push to remote')
  .action(async (options) => {
    try {
      // Check that at least one of qa or uat is provided
      if (!options.qa && !options.uat) {
        console.error(chalk.red('Error: Must provide at least one of --qa or --uat'));
        console.log(chalk.yellow('\nExamples:'));
        console.log('  cggit hotfix --qa qa-release-1.0');
        console.log('  cggit hotfix --uat uat-release-1.0');
        console.log('  cggit hotfix --qa qa-release-1.0 --uat uat-release-1.0');
        process.exit(1);
      }

      const HotfixBranchCreator = require('../src/index');
      const creator = new HotfixBranchCreator({
        qaBranch: options.qa,
        uatBranch: options.uat,
        noPush: options.noPush
      });

      await creator.run();
    } catch (error) {
      console.error(chalk.red(`\nError: ${error.message}`));
      process.exit(1);
    }
  });

// Create PR command
program
  .command('pr')
  .description('Create pull requests for QA and/or UAT hotfix branches')
  .option('--dev-pr <number>', 'DEV PR number to copy from (auto-detected from GitHub if not provided)')
  .option('--qa <branch>', 'QA base branch name (e.g., qa-release-1.0)')
  .option('--uat <branch>', 'UAT base branch name (e.g., uat-release-1.0)')
  .option('--token <token>', 'GitHub personal access token (or set GITHUB_TOKEN env var)')
  .action(async (options) => {
    try {
      // Check that at least one of qa or uat is provided
      if (!options.qa && !options.uat) {
        console.error(chalk.red('Error: Must provide at least one of --qa or --uat'));
        console.log(chalk.yellow('\nExamples:'));
        console.log('  cggit pr --qa qa-release-1.0');
        console.log('  cggit pr --uat uat-release-1.0');
        console.log('  cggit pr --dev-pr 123 --qa qa-release-1.0 --uat uat-release-1.0');
        process.exit(1);
      }

      const PullRequestCreator = require('../src/pr-creator');
      const creator = new PullRequestCreator({
        devPrNumber: options.devPr ? parseInt(options.devPr, 10) : null,
        qaBranch: options.qa,
        uatBranch: options.uat,
        githubToken: options.token
      });

      await creator.run();
    } catch (error) {
      console.error(chalk.red(`\nError: ${error.message}`));
      process.exit(1);
    }
  });

// Create release tag command
program
  .command('release')
  .description('Create release tag for QA or UAT')
  .option('--qa <branch>', 'Create QA release tag from QA branch')
  .option('--uat <branch>', 'Create UAT release tag from UAT branch')
  .option('--version <version>', 'Specific version tag (e.g., v1.23.5). If not provided, auto-increments from latest')
  .option('--draft', 'Create as draft release (default: false)')
  .option('--helm', 'Generate helm chart with version matching tag (default: false)')
  .action(async (options) => {
    try {
      // Check that exactly one of qa or uat is provided
      if ((!options.qa && !options.uat) || (options.qa && options.uat)) {
        console.error(chalk.red('Error: Must provide exactly one of --qa or --uat'));
        console.log(chalk.yellow('\nExamples:'));
        console.log('  cggit release --qa release/v1.23                    # Auto-increment from latest');
        console.log('  cggit release --qa release/v1.23 --version v1.23.5  # Specific version');
        console.log('  cggit release --qa release/v1.23 --draft            # Create as draft');
        console.log('  cggit release --qa release/v1.23 --helm             # Generate helm chart');
        console.log('  cggit release --uat release/v1.23');
        process.exit(1);
      }

      const ReleaseCreator = require('../src/release-creator');
      const creator = new ReleaseCreator({
        environment: options.qa ? 'qa' : 'uat',
        baseBranch: options.qa || options.uat,
        version: options.version,
        draft: options.draft,
        helm: options.helm
      });

      await creator.run();
    } catch (error) {
      console.error(chalk.red(`\nError: ${error.message}`));
      process.exit(1);
    }
  });

// Generate helm chart command
program
  .command('helm')
  .description('Trigger GitHub workflow to update helm chart')
  .option('--version <version>', 'Version for helm chart (e.g., v1.23.5 or 1.23.5)')
  .action(async (options) => {
    try {
      const HelmGenerator = require('../src/helm-generator');
      const generator = new HelmGenerator({
        version: options.version
      });

      await generator.run();
    } catch (error) {
      console.error(chalk.red(`\nError: ${error.message}`));
      process.exit(1);
    }
  });

// Show help if no command provided
if (process.argv.length === 2) {
  program.outputHelp();
  console.log('');
  console.log(chalk.cyan('Examples:'));
  console.log(chalk.gray('  cggit setup                                         # Setup GitHub token'));
  console.log(chalk.gray('  cggit hotfix --qa qa-release-1.0                    # Create hotfix branches'));
  console.log(chalk.gray('  cggit pr --qa qa-release-1.0                        # Create PRs'));
  console.log(chalk.gray('  cggit release --qa release/v1.23                    # Auto-increment release'));
  console.log(chalk.gray('  cggit release --qa release/v1.23 --version v1.23.5  # Specific version'));
  console.log(chalk.gray('  cggit helm --version v1.23.5                        # Update helm chart'));
  console.log('');
}

program.parse(process.argv);

