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

// Show help if no command provided
if (process.argv.length === 2) {
  program.outputHelp();
  console.log('');
  console.log(chalk.cyan('Examples:'));
  console.log(chalk.gray('  cggit setup                           # Setup GitHub token'));
  console.log(chalk.gray('  cggit hotfix --qa qa-release-1.0      # Create hotfix branches'));
  console.log(chalk.gray('  cggit pr --qa qa-release-1.0          # Create PRs'));
  console.log('');
}

program.parse(process.argv);

