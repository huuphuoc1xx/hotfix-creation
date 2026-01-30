const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const simpleGit = require('simple-git');

class ConfigManager {
  static CONFIG_DIR = path.join(os.homedir(), '.create-hotfix');
  static CONFIG_FILE = path.join(ConfigManager.CONFIG_DIR, 'branches.json');

  /**
   * Get repository identifier from git remote
   */
  static async getRepositoryId() {
    try {
      const git = simpleGit();
      const remotes = await git.getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin');
      
      if (!origin) {
        return 'default'; // Fallback to default if no origin
      }

      // Parse repository name from URL
      const url = origin.refs.fetch;
      let repoId;
      
      // Try SSH format: git@github.com:owner/repo.git
      let match = url.match(/git@github\.com:(.+?)\/(.+?)(?:\.git)?$/);
      if (match) {
        repoId = `${match[1]}/${match[2]}`;
      } else {
        // Try HTTPS format: https://github.com/owner/repo.git
        match = url.match(/https:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/);
        if (match) {
          repoId = `${match[1]}/${match[2]}`;
        } else {
          repoId = 'default';
        }
      }
      
      return repoId;
    } catch (error) {
      return 'default'; // Fallback to default on error
    }
  }

  /**
   * Load all configurations
   */
  static async loadAllConfigs() {
    try {
      const content = await fs.readFile(ConfigManager.CONFIG_FILE, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return {}; // Return empty object if file doesn't exist
    }
  }

  /**
   * Load branch configuration for current repository
   */
  static async loadConfig() {
    const repoId = await ConfigManager.getRepositoryId();
    const allConfigs = await ConfigManager.loadAllConfigs();
    
    // Return config for this repository, or empty config
    return allConfigs[repoId] || {
      qa: { branch: null, version: null },
      uat: { branch: null, version: null },
      preProd: { branch: null, version: null },
      prod: { branch: null, version: null }
    };
  }

  /**
   * Save branch configuration for current repository
   */
  static async saveConfig(config) {
    try {
      const repoId = await ConfigManager.getRepositoryId();
      
      // Load all configs
      const allConfigs = await ConfigManager.loadAllConfigs();
      
      // Update config for this repository
      allConfigs[repoId] = config;
      
      // Ensure directory exists
      await fs.mkdir(ConfigManager.CONFIG_DIR, { recursive: true });
      
      // Save all configs
      await fs.writeFile(
        ConfigManager.CONFIG_FILE,
        JSON.stringify(allConfigs, null, 2),
        'utf-8'
      );
      
      return true;
    } catch (error) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }

  /**
   * Update specific branch in config
   */
  static async updateBranch(env, branchName, version = null) {
    const config = await ConfigManager.loadConfig();
    // Ensure config[env] is an object
    if (typeof config[env] !== 'object' || config[env] === null) {
      config[env] = { branch: null, version: null };
    }
    config[env].branch = branchName;
    if (version !== null) {
      config[env].version = version;
    }
    await ConfigManager.saveConfig(config);
  }

  /**
   * Get branch name for environment
   */
  static async getBranch(env) {
    const config = await ConfigManager.loadConfig();
    const envConfig = config[env];
    // Support both old format (string) and new format (object)
    if (typeof envConfig === 'string') {
      return envConfig;
    }
    return envConfig?.branch || null;
  }

  /**
   * Get version for environment
   */
  static async getVersion(env) {
    const config = await ConfigManager.loadConfig();
    const envConfig = config[env];
    if (typeof envConfig === 'object' && envConfig !== null) {
      return envConfig.version || null;
    }
    return null;
  }

  /**
   * Update version for environment
   */
  static async updateVersion(env, version) {
    const config = await ConfigManager.loadConfig();
    // Ensure config[env] is an object
    if (typeof config[env] !== 'object' || config[env] === null) {
      config[env] = { branch: null, version: null };
    }
    config[env].version = version;
    await ConfigManager.saveConfig(config);
  }

  /**
   * Clear configuration for current repository
   */
  static async clearConfig() {
    try {
      const repoId = await ConfigManager.getRepositoryId();
      const allConfigs = await ConfigManager.loadAllConfigs();
      
      // Remove config for this repository
      delete allConfigs[repoId];
      
      // Save updated configs
      if (Object.keys(allConfigs).length === 0) {
        // If no configs left, delete the file
        await fs.unlink(ConfigManager.CONFIG_FILE);
      } else {
        // Otherwise save remaining configs
        await fs.writeFile(
          ConfigManager.CONFIG_FILE,
          JSON.stringify(allConfigs, null, 2),
          'utf-8'
        );
      }
      
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return true; // File doesn't exist, that's fine
      }
      throw new Error(`Failed to clear config: ${error.message}`);
    }
  }

  /**
   * Display current configuration
   */
  static async displayConfig() {
    const repoId = await ConfigManager.getRepositoryId();
    const config = await ConfigManager.loadConfig();
    
    console.log('');
    console.log(chalk.cyan(`Current Configuration (${repoId}):`));
    console.log(chalk.gray('─'.repeat(70)));
    console.log(chalk.gray(`  ${'Environment'.padEnd(12)} ${'Branch'.padEnd(30)} Version`));
    console.log(chalk.gray('─'.repeat(70)));
    
    const envs = [
      { key: 'qa', label: 'QA' },
      { key: 'uat', label: 'UAT' },
      { key: 'preProd', label: 'PRE-PROD' },
      { key: 'prod', label: 'PROD' }
    ];

    for (const env of envs) {
      const envConfig = config[env.key];
      let branch = '(not set)';
      let version = '(not set)';
      
      // Support both old format (string) and new format (object)
      if (typeof envConfig === 'string') {
        branch = envConfig;
      } else if (typeof envConfig === 'object' && envConfig !== null) {
        branch = envConfig.branch || '(not set)';
        version = envConfig.version || '(not set)';
      }
      
      const branchDisplay = branch === '(not set)' ? chalk.gray(branch) : chalk.green(branch);
      const versionDisplay = version === '(not set)' ? chalk.gray(version) : chalk.yellow(version);
      
      console.log(`  ${env.label.padEnd(12)} ${branchDisplay.padEnd(30)} ${versionDisplay}`);
    }
    
    console.log('');
  }

  /**
   * Merge provided options with saved config
   * Provided options take precedence over saved config
   */
  static async mergeWithConfig(options) {
    const config = await ConfigManager.loadConfig();
    
    // Helper to get branch from config (support both old and new format)
    const getBranchFromConfig = (envConfig) => {
      if (typeof envConfig === 'string') return envConfig;
      if (typeof envConfig === 'object' && envConfig !== null) return envConfig.branch;
      return null;
    };
    
    return {
      qaBranch: options.qa || getBranchFromConfig(config.qa),
      uatBranch: options.uat || getBranchFromConfig(config.uat),
      preProdBranch: options.preProd || getBranchFromConfig(config.preProd),
      prodBranch: options.prod || getBranchFromConfig(config.prod)
    };
  }
}

module.exports = ConfigManager;

