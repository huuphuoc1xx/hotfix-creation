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
  .option('-y, --yes', 'Skip all confirmation prompts')
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

// Config branches command
program
  .command('config')
  .description('Configure default branches and versions for environments')
  .option('--show', 'Show current configuration')
  .option('--clear', 'Clear saved configuration')
  .option('-q, --qa <branch>', 'Set QA branch')
  .option('--qa-version <version>', 'Set QA version (e.g., 1.23)')
  .option('-u, --uat <branch>', 'Set UAT branch')
  .option('--uat-version <version>', 'Set UAT version (e.g., 1.23)')
  .option('--pre-prod <branch>', 'Set PRE-PROD branch')
  .option('--pre-prod-version <version>', 'Set PRE-PROD version (e.g., 1.23)')
  .option('-p, --prod <branch>', 'Set PROD branch')
  .option('--prod-version <version>', 'Set PROD version (e.g., 1.23)')
  .option('--copy <from:to>', 'Copy config from one env to another (e.g., qa:uat, uat:pre-prod)')
  .option('-y, --yes', 'Skip all confirmation prompts')
  .action(async (options) => {
    try {
      const configCommand = require('./config-logic');
      await configCommand(options);
    } catch (error) {
      console.error(chalk.red(`\nError: ${error.message}`));
      process.exit(1);
    }
  });

// Create hotfix branches command
program
  .command('hotfix')
  .description('Create hotfix branches for QA, UAT, PRE-PROD, and/or PROD')
  .option('-q, --qa [branch]', 'QA base branch name (e.g., qa-release-1.0). Use flag without value to use saved config.')
  .option('-u, --uat [branch]', 'UAT base branch name (e.g., uat-release-1.0). Use flag without value to use saved config.')
  .option('--pre-prod [branch]', 'PRE-PROD base branch name (e.g., pre-prod-release-1.0). Use flag without value to use saved config.')
  .option('-p, --prod [branch]', 'PROD base branch name (e.g., prod-release-1.0). Use flag without value to use saved config.')
  .option('-n, --no-push', 'Create branches but don\'t push to remote')
  .option('-y, --yes', 'Skip all confirmation prompts')
  .action(async (options) => {
    try {
      const ConfigManager = require('../src/utils/config-manager');
      
      // Load saved config
      const config = await ConfigManager.loadConfig();
      
      // Helper to get branch from config (support both old and new format)
      const getBranchFromConfig = (envConfig) => {
        if (typeof envConfig === 'string') return envConfig;
        if (typeof envConfig === 'object' && envConfig !== null) return envConfig.branch;
        return null;
      };
      
      // Determine which branches to use
      // If option is true (flag without value), use saved config
      // If option is string, use provided value
      // If option is undefined/false, skip that environment
      const qaBranch = options.qa === true ? getBranchFromConfig(config.qa) : (options.qa || null);
      const uatBranch = options.uat === true ? getBranchFromConfig(config.uat) : (options.uat || null);
      const preProdBranch = options.preProd === true ? getBranchFromConfig(config.preProd) : (options.preProd || null);
      const prodBranch = options.prod === true ? getBranchFromConfig(config.prod) : (options.prod || null);

      // Check that at least one environment is provided
      if (!qaBranch && !uatBranch && !preProdBranch && !prodBranch) {
        console.error(chalk.red('Error: Must provide at least one environment'));
        console.log(chalk.yellow('\nExamples:'));
        console.log(chalk.gray('  With saved config:'));
        console.log('    cggit hotfix -q -u --pre-prod -p');
        console.log(chalk.gray('  With explicit branch names:'));
        console.log('    cggit hotfix -q qa-release-1.0');
        console.log('    cggit hotfix -u uat-release-1.0');
        console.log('    cggit hotfix --pre-prod pre-prod-release-1.0');
        console.log('    cggit hotfix -p prod-release-1.0');
        console.log(chalk.gray('  Mixed (some from config, some explicit):'));
        console.log('    cggit hotfix -q -u uat-release-2.0 -p');
        console.log('');
        console.log(chalk.yellow('Tip: Run "cggit config" to save default branches'));
        process.exit(1);
      }

      const HotfixBranchCreator = require('../src/index');
      const creator = new HotfixBranchCreator({
        qaBranch,
        uatBranch,
        preProdBranch,
        prodBranch,
        noPush: options.noPush,
        yes: options.yes
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
  .option('-q, --qa [branch]', 'QA base branch name (e.g., qa-release-1.0). Use flag without value to use saved config.')
  .option('-u, --uat [branch]', 'UAT base branch name (e.g., uat-release-1.0). Use flag without value to use saved config.')
  .option('--pre-prod [branch]', 'PRE-PROD base branch name (e.g., pre-prod-release-1.0). Use flag without value to use saved config.')
  .option('-p, --prod [branch]', 'PROD base branch name (e.g., prod-release-1.0). Use flag without value to use saved config.')
  .option('-t, --token <token>', 'GitHub personal access token (or set GITHUB_TOKEN env var)')
  .option('-y, --yes', 'Skip all confirmation prompts')
  .action(async (options) => {
    try {
      const ConfigManager = require('../src/utils/config-manager');
      
      // Load saved config
      const config = await ConfigManager.loadConfig();
      
      // Helper to get branch from config (support both old and new format)
      const getBranchFromConfig = (envConfig) => {
        if (typeof envConfig === 'string') return envConfig;
        if (typeof envConfig === 'object' && envConfig !== null) return envConfig.branch;
        return null;
      };
      
      // Determine which branches to use
      // If option is true (flag without value), use saved config
      // If option is string, use provided value
      // If option is undefined/false, skip that environment
      const qaBranch = options.qa === true ? getBranchFromConfig(config.qa) : (options.qa || null);
      const uatBranch = options.uat === true ? getBranchFromConfig(config.uat) : (options.uat || null);
      const preProdBranch = options.preProd === true ? getBranchFromConfig(config.preProd) : (options.preProd || null);
      const prodBranch = options.prod === true ? getBranchFromConfig(config.prod) : (options.prod || null);

      // Check that at least one environment is provided
      if (!qaBranch && !uatBranch && !preProdBranch && !prodBranch) {
        console.error(chalk.red('Error: Must provide at least one environment'));
        console.log(chalk.yellow('\nExamples:'));
        console.log(chalk.gray('  With saved config:'));
        console.log('    cggit pr -q -u --pre-prod -p');
        console.log(chalk.gray('  With explicit branch names:'));
        console.log('    cggit pr -q qa-release-1.0');
        console.log('    cggit pr -u uat-release-1.0');
        console.log('    cggit pr --pre-prod pre-prod-release-1.0');
        console.log('    cggit pr -p prod-release-1.0');
        console.log(chalk.gray('  With DEV PR number:'));
        console.log('    cggit pr -d 123 -q -u -p');
        console.log(chalk.gray('  Mixed (some from config, some explicit):'));
        console.log('    cggit pr -q -u uat-release-2.0 -p');
        console.log('');
        console.log(chalk.yellow('Tip: Run "cggit config" to save default branches'));
        process.exit(1);
      }

      const PullRequestCreator = require('../src/pr-creator');
      const creator = new PullRequestCreator({
        devPrNumber: options.devPr ? parseInt(options.devPr, 10) : null,
        qaBranch,
        uatBranch,
        preProdBranch,
        prodBranch,
        githubToken: options.token,
        yes: options.yes
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
  .option('-e, --env <environment>', 'Environment (qa/uat/pre-prod/prod) - use saved branch and version')
  .option('-v, --version <version>', 'Specific version tag (e.g., v1.23.5). If not provided, auto-increments from latest')
  .option('-d, --draft', 'Create as draft release (default: false)')
  .option('-l, --latest', 'Set as latest release (default: false)')
  .option('-h, --helm', 'Generate helm chart with version matching tag (default: false)')
  .option('-bv, --branch-version <branchVersion>', 'Branch version (e.g., 1.23)')
  .option('-y, --yes', 'Skip all confirmation prompts')
  .action(async (options) => {
    try {
      const ConfigManager = require('../src/utils/config-manager');
      
      let baseBranch = options.branch;
      let branchVersion = options.branchVersion;
      
      // If environment is specified, load from config
      if (options.env) {
        const envMap = {
          'qa': 'qa',
          'uat': 'uat',
          'pre-prod': 'preProd',
          'preprod': 'preProd',
          'prod': 'prod'
        };
        
        const envKey = envMap[options.env.toLowerCase()];
        if (!envKey) {
          console.error(chalk.red(`Invalid environment: ${options.env}`));
          console.log(chalk.yellow('Valid environments: qa, uat, pre-prod, prod'));
          process.exit(1);
        }
        
        const branch = await ConfigManager.getBranch(envKey);
        const version = await ConfigManager.getVersion(envKey);
        
        if (!branch) {
          console.error(chalk.red(`No branch configured for ${options.env}`));
          console.log(chalk.yellow(`Run: cggit config -${envKey === 'qa' ? 'q' : envKey === 'uat' ? 'u' : envKey === 'preProd' ? '-pre-prod' : 'p'} <branch>`));
          process.exit(1);
        }
        
        baseBranch = branch;
        branchVersion = branchVersion || version; // Use provided version or config version
        
        console.log(chalk.cyan(`Using ${options.env.toUpperCase()} configuration:`));
        console.log(chalk.gray(`  Branch: ${branch}`));
        if (version) {
          console.log(chalk.gray(`  Version: ${version}`));
        }
        console.log('');
      }
      
      const ReleaseCreator = require('../src/release-creator');
      const creator = new ReleaseCreator({
        baseBranch,
        branchVersion,
        version: options.version,
        draft: options.draft,
        latest: options.latest,
        helm: options.helm,
        yes: options.yes
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
  .option('-e, --env <environment>', 'Environment (qa/uat/pre-prod/prod) - use saved version')
  .option('-y, --yes', 'Skip all confirmation prompts')
  .action(async (options) => {
    try {
      const ConfigManager = require('../src/utils/config-manager');
      
      let version = options.version;
      
      // If environment is specified, load version from config
      if (options.env) {
        const envMap = {
          'qa': 'qa',
          'uat': 'uat',
          'pre-prod': 'preProd',
          'preprod': 'preProd',
          'prod': 'prod'
        };
        
        const envKey = envMap[options.env.toLowerCase()];
        if (!envKey) {
          console.error(chalk.red(`Invalid environment: ${options.env}`));
          console.log(chalk.yellow('Valid environments: qa, uat, pre-prod, prod'));
          process.exit(1);
        }
        
        const configVersion = await ConfigManager.getVersion(envKey);
        
        if (!configVersion) {
          console.error(chalk.red(`No version configured for ${options.env}`));
          console.log(chalk.yellow(`Run: cggit config --${envKey === 'qa' ? 'qa' : envKey === 'uat' ? 'uat' : envKey === 'preProd' ? 'pre-prod' : 'prod'}-version <version>`));
          process.exit(1);
        }
        
        version = version || configVersion; // Use provided version or config version
        
        console.log(chalk.cyan(`Using ${options.env.toUpperCase()} configuration:`));
        console.log(chalk.gray(`  Version: ${configVersion}`));
        console.log('');
      }
      
      if (!version) {
        console.error(chalk.red('Version is required'));
        console.log(chalk.yellow('Provide version with -v or use --env to load from config'));
        console.log(chalk.yellow('Examples:'));
        console.log(chalk.gray('  cggit helm -v v1.23.5'));
        console.log(chalk.gray('  cggit helm --env qa'));
        process.exit(1);
      }
      
      const HelmGenerator = require('../src/helm-generator');
      const generator = new HelmGenerator({
        version,
        yes: options.yes
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
  console.log(chalk.gray('  cggit config                               # Configure all (interactive)'));
  console.log(chalk.gray('  cggit config -q qa-release-1.0 --qa-version 1.23  # Set QA branch + version'));
  console.log(chalk.gray('  cggit config --show                        # Show current config'));
  console.log(chalk.gray('  cggit config --copy qa:uat                  # Copy QA config to UAT'));
  console.log(chalk.gray('  cggit hotfix -q -u -p -y                    # Use saved config, skip prompts'));
  console.log(chalk.gray('  cggit pr -q -u --pre-prod -p -y            # Use saved config, skip prompts'));
  console.log(chalk.gray('  cggit release --env qa                     # Release using QA config'));
  console.log(chalk.gray('  cggit release --env prod                   # Release using PROD config'));
  console.log(chalk.gray('  cggit release -b release/v1.23 -v v1.23.5  # Explicit branch + version'));
  console.log(chalk.gray('  cggit helm --env qa                        # Update helm using QA version'));
  console.log(chalk.gray('  cggit helm -v v1.23.5                      # Update helm with explicit version'));
  console.log('');
}

program.parse(process.argv);

