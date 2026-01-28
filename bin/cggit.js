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
  .description('Create hotfix branches for QA, UAT, PRE-PROD, and/or PROD')
  .option('-q, --qa <branch>', 'QA base branch name (e.g., qa-release-1.0)')
  .option('-u, --uat <branch>', 'UAT base branch name (e.g., uat-release-1.0)')
  .option('--pre-prod <branch>', 'PRE-PROD base branch name (e.g., pre-prod-release-1.0)')
  .option('-p, --prod <branch>', 'PROD base branch name (e.g., prod-release-1.0)')
  .option('-n, --no-push', 'Create branches but don\'t push to remote')
  .action(async (options) => {
    try {
      // Check that at least one environment is provided
      if (!options.qa && !options.uat && !options.preProd && !options.prod) {
        console.error(chalk.red('Error: Must provide at least one of --qa, --uat, --pre-prod, or --prod'));
        console.log(chalk.yellow('\nExamples:'));
        console.log('  cggit hotfix -q qa-release-1.0');
        console.log('  cggit hotfix -u uat-release-1.0');
        console.log('  cggit hotfix --pre-prod pre-prod-release-1.0');
        console.log('  cggit hotfix -p prod-release-1.0');
        console.log('  cggit hotfix -q qa-release-1.0 -u uat-release-1.0 --pre-prod pre-prod-release-1.0 -p prod-release-1.0');
        process.exit(1);
      }

      const HotfixBranchCreator = require('../src/index');
      const creator = new HotfixBranchCreator({
        qaBranch: options.qa,
        uatBranch: options.uat,
        preProdBranch: options.preProd,
        prodBranch: options.prod,
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
  .description('Create pull requests for QA, UAT, PRE-PROD, and/or PROD hotfix branches')
  .option('-d, --dev-pr <number>', 'DEV PR number to copy from (auto-detected from GitHub if not provided)')
  .option('-q, --qa <branch>', 'QA base branch name (e.g., qa-release-1.0)')
  .option('-u, --uat <branch>', 'UAT base branch name (e.g., uat-release-1.0)')
  .option('--pre-prod <branch>', 'PRE-PROD base branch name (e.g., pre-prod-release-1.0)')
  .option('-p, --prod <branch>', 'PROD base branch name (e.g., prod-release-1.0)')
  .option('-t, --token <token>', 'GitHub personal access token (or set GITHUB_TOKEN env var)')
  .action(async (options) => {
    try {
      // Check that at least one environment is provided
      if (!options.qa && !options.uat && !options.preProd && !options.prod) {
        console.error(chalk.red('Error: Must provide at least one of --qa, --uat, --pre-prod, or --prod'));
        console.log(chalk.yellow('\nExamples:'));
        console.log('  cggit pr -q qa-release-1.0');
        console.log('  cggit pr -u uat-release-1.0');
        console.log('  cggit pr --pre-prod pre-prod-release-1.0');
        console.log('  cggit pr -p prod-release-1.0');
        console.log('  cggit pr -d 123 -q qa-release-1.0 -u uat-release-1.0 --pre-prod pre-prod-release-1.0 -p prod-release-1.0');
        process.exit(1);
      }

      const PullRequestCreator = require('../src/pr-creator');
      const creator = new PullRequestCreator({
        devPrNumber: options.devPr ? parseInt(options.devPr, 10) : null,
        qaBranch: options.qa,
        uatBranch: options.uat,
        preProdBranch: options.preProd,
        prodBranch: options.prod,
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
  .description('Create GitHub release from a branch')
  .option('-b, --branch <branch>', 'Release branch name (e.g., release/v1.23)')
  .option('-v, --version <version>', 'Specific version tag (e.g., v1.23.5). If not provided, auto-increments from latest')
  .option('-d, --draft', 'Create as draft release (default: false)')
  .option('-l, --latest', 'Set as latest release (default: false)')
  .option('-h, --helm', 'Generate helm chart with version matching tag (default: false)')
  .action(async (options) => {
    try {
      const ReleaseCreator = require('../src/release-creator');
      const creator = new ReleaseCreator({
        baseBranch: options.branch,
        version: options.version,
        draft: options.draft,
        latest: options.latest,
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
  .option('-v, --version <version>', 'Version for helm chart (e.g., v1.23.5 or 1.23.5)')
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
  console.log(chalk.gray('  cggit setup                                # Setup GitHub token'));
  console.log(chalk.gray('  cggit hotfix -q qa-release-1.0 -u uat-release-1.0 --pre-prod pre-prod-release-1.0 -p prod-release-1.0'));
  console.log(chalk.gray('  cggit pr -q qa-release-1.0 -u uat-release-1.0 --pre-prod pre-prod-release-1.0 -p prod-release-1.0'));
  console.log(chalk.gray('  cggit release -b release/v1.23             # Auto-increment release'));
  console.log(chalk.gray('  cggit release -b release/v1.23 -v v1.23.5  # Specific version'));
  console.log(chalk.gray('  cggit release -b release/v1.23 -l          # Set as latest'));
  console.log(chalk.gray('  cggit release -b release/v1.23 -d -h       # Draft + helm'));
  console.log(chalk.gray('  cggit helm -v v1.23.5                      # Update helm chart'));
  console.log('');
}

program.parse(process.argv);

