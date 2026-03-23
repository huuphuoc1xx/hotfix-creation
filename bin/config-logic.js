const chalk = require('chalk');
const inquirer = require('inquirer');
const ConfigManager = require('../src/utils/config-manager');

const ENV_MAP = {
  'qa': 'qa',
  'uat': 'uat',
  'pre-prod': 'preProd',
  'preprod': 'preProd',
  'prod': 'prod'
};

const ENV_LABELS = { qa: 'QA', uat: 'UAT', preProd: 'PRE-PROD', prod: 'PROD' };

function parseEnv(name) {
  const key = ENV_MAP[name.toLowerCase()];
  return key || null;
}

async function configCommand(options) {
  try {
    // Copy config from one env to another
    if (options.copy) {
      const parts = options.copy.split(':').map(s => s.trim());
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        console.error(chalk.red('Error: --copy must be in format <from:to>, e.g. qa:uat or uat:pre-prod'));
        console.log(chalk.yellow('Valid environments: qa, uat, pre-prod, prod'));
        return;
      }
      const fromKey = parseEnv(parts[0]);
      const toKey = parseEnv(parts[1]);
      if (!fromKey) {
        console.error(chalk.red(`Invalid source environment: ${parts[0]}`));
        console.log(chalk.yellow('Valid environments: qa, uat, pre-prod, prod'));
        return;
      }
      if (!toKey) {
        console.error(chalk.red(`Invalid target environment: ${parts[1]}`));
        console.log(chalk.yellow('Valid environments: qa, uat, pre-prod, prod'));
        return;
      }
      if (fromKey === toKey) {
        console.error(chalk.red('Source and target environment must be different'));
        return;
      }
      const currentConfig = await ConfigManager.loadConfig();
      const fromConfig = currentConfig[fromKey];
      const branch = typeof fromConfig === 'string' ? fromConfig : (fromConfig && fromConfig.branch);
      const version = typeof fromConfig === 'object' && fromConfig ? fromConfig.version : null;
      if (!branch && !version) {
        console.error(chalk.red(`No config to copy from ${ENV_LABELS[fromKey]}`));
        return;
      }
      if (typeof currentConfig[toKey] !== 'object' || currentConfig[toKey] === null) {
        currentConfig[toKey] = { branch: null, version: null };
      }
      if (branch) currentConfig[toKey].branch = branch;
      if (version) currentConfig[toKey].version = version;
      await ConfigManager.saveConfig(currentConfig);
      console.log(chalk.green(`✓ Copied config from ${ENV_LABELS[fromKey]} to ${ENV_LABELS[toKey]}`));
      if (branch) console.log(chalk.gray(`  Branch: ${branch}`));
      if (version) console.log(chalk.gray(`  Version: ${version}`));
      console.log('');
      await ConfigManager.displayConfig();
      return;
    }

    // Show current config
    if (options.show) {
      await ConfigManager.displayConfig();
      return;
    }

    // Clear config
    if (options.clear) {
      let confirm = options.yes === true;
      if (!confirm) {
        const answer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to clear all branch configuration?',
            default: false
          }
        ]);
        confirm = answer.confirm;
      }

      if (confirm) {
        await ConfigManager.clearConfig();
        console.log(chalk.green('\n✓ Branch configuration cleared successfully\n'));
      } else {
        console.log(chalk.yellow('\nOperation cancelled\n'));
      }
      return;
    }

    // Set individual branch or version
    if (options.qa || options.uat || options.preProd || options.prod || 
        options.qaVersion || options.uatVersion || options.preProdVersion || options.prodVersion) {
      const currentConfig = await ConfigManager.loadConfig();
      
      // Helper to ensure config entry is an object
      const ensureObject = (key) => {
        if (typeof currentConfig[key] !== 'object' || currentConfig[key] === null) {
          currentConfig[key] = { branch: null, version: null };
        }
      };
      
      if (options.qa) {
        ensureObject('qa');
        currentConfig.qa.branch = options.qa;
        console.log(chalk.green(`✓ QA branch set to: ${options.qa}`));
      }
      if (options.qaVersion) {
        ensureObject('qa');
        currentConfig.qa.version = options.qaVersion;
        console.log(chalk.green(`✓ QA version set to: ${options.qaVersion}`));
      }
      
      if (options.uat) {
        ensureObject('uat');
        currentConfig.uat.branch = options.uat;
        console.log(chalk.green(`✓ UAT branch set to: ${options.uat}`));
      }
      if (options.uatVersion) {
        ensureObject('uat');
        currentConfig.uat.version = options.uatVersion;
        console.log(chalk.green(`✓ UAT version set to: ${options.uatVersion}`));
      }
      
      if (options.preProd) {
        ensureObject('preProd');
        currentConfig.preProd.branch = options.preProd;
        console.log(chalk.green(`✓ PRE-PROD branch set to: ${options.preProd}`));
      }
      if (options.preProdVersion) {
        ensureObject('preProd');
        currentConfig.preProd.version = options.preProdVersion;
        console.log(chalk.green(`✓ PRE-PROD version set to: ${options.preProdVersion}`));
      }
      
      if (options.prod) {
        ensureObject('prod');
        currentConfig.prod.branch = options.prod;
        console.log(chalk.green(`✓ PROD branch set to: ${options.prod}`));
      }
      if (options.prodVersion) {
        ensureObject('prod');
        currentConfig.prod.version = options.prodVersion;
        console.log(chalk.green(`✓ PROD version set to: ${options.prodVersion}`));
      }
      
      await ConfigManager.saveConfig(currentConfig);
      console.log('');
      await ConfigManager.displayConfig();
      return;
    }

    // Interactive setup
    console.log('');
    console.log(chalk.cyan('Branch Configuration Setup'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.gray('Configure default branches for each environment.'));
    console.log(chalk.gray('Leave empty to skip or keep existing value.'));
    console.log('');

    // Load current config
    const currentConfig = await ConfigManager.loadConfig();

    // Helper to get value from config (support both old and new format)
    const getValue = (envConfig, key) => {
      if (typeof envConfig === 'string' && key === 'branch') return envConfig;
      if (typeof envConfig === 'object' && envConfig !== null) return envConfig[key] || '';
      return '';
    };

    // Prompt for each environment
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'qaBranch',
        message: 'QA branch name:',
        default: getValue(currentConfig.qa, 'branch'),
        validate: (input) => {
          if (input && !/^[a-zA-Z0-9\-_/.]+$/.test(input)) {
            return 'Invalid branch name';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'qaVersion',
        message: 'QA version (e.g., 1.23):',
        default: getValue(currentConfig.qa, 'version')
      },
      {
        type: 'input',
        name: 'uatBranch',
        message: 'UAT branch name:',
        default: getValue(currentConfig.uat, 'branch'),
        validate: (input) => {
          if (input && !/^[a-zA-Z0-9\-_/.]+$/.test(input)) {
            return 'Invalid branch name';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'uatVersion',
        message: 'UAT version (e.g., 1.23):',
        default: getValue(currentConfig.uat, 'version')
      },
      {
        type: 'input',
        name: 'preProdBranch',
        message: 'PRE-PROD branch name:',
        default: getValue(currentConfig.preProd, 'branch'),
        validate: (input) => {
          if (input && !/^[a-zA-Z0-9\-_/.]+$/.test(input)) {
            return 'Invalid branch name';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'preProdVersion',
        message: 'PRE-PROD version (e.g., 1.23):',
        default: getValue(currentConfig.preProd, 'version')
      },
      {
        type: 'input',
        name: 'prodBranch',
        message: 'PROD branch name:',
        default: getValue(currentConfig.prod, 'branch'),
        validate: (input) => {
          if (input && !/^[a-zA-Z0-9\-_/.]+$/.test(input)) {
            return 'Invalid branch name';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'prodVersion',
        message: 'PROD version (e.g., 1.23):',
        default: getValue(currentConfig.prod, 'version')
      }
    ]);

    // Build new config (keep existing values if not provided)
    const newConfig = {
      qa: {
        branch: answers.qaBranch || getValue(currentConfig.qa, 'branch'),
        version: answers.qaVersion || getValue(currentConfig.qa, 'version')
      },
      uat: {
        branch: answers.uatBranch || getValue(currentConfig.uat, 'branch'),
        version: answers.uatVersion || getValue(currentConfig.uat, 'version')
      },
      preProd: {
        branch: answers.preProdBranch || getValue(currentConfig.preProd, 'branch'),
        version: answers.preProdVersion || getValue(currentConfig.preProd, 'version')
      },
      prod: {
        branch: answers.prodBranch || getValue(currentConfig.prod, 'branch'),
        version: answers.prodVersion || getValue(currentConfig.prod, 'version')
      }
    };

    // Save config
    await ConfigManager.saveConfig(newConfig);

    console.log('');
    console.log(chalk.green('✓ Configuration saved successfully!'));
    console.log('');
    await ConfigManager.displayConfig();
    console.log(chalk.gray('Now you can use shortcuts:'));
    console.log(chalk.yellow('  cggit hotfix -q -u --pre-prod -p'));
    console.log(chalk.yellow('  cggit pr -q -u --pre-prod -p'));
    console.log(chalk.yellow('  cggit release --env qa    # Use QA version'));
    console.log('');

  } catch (error) {
    console.error(chalk.red(`\nError: ${error.message}\n`));
    throw error;
  }
}

module.exports = configCommand;

