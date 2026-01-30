const simpleGit = require('simple-git');
const chalk = require('chalk');
const inquirer = require('inquirer');
const GitHubUtils = require('./utils/github-utils');

class ReleaseCreator {
  constructor(options = {}) {
    this.git = simpleGit();
    this.baseBranch = options.baseBranch; // e.g., 'release/v1.23'
    this.branchVersion = options.branchVersion; // e.g., '1.23'
    this.version = options.version; // specific version (e.g., 'v1.23.5')
    this.draft = options.draft || false; // create as draft release
    this.helm = options.helm || false; // generate helm chart with version
    this.latest = options.latest || 'false'; // set as latest release
    this.githubToken = options.githubToken;
    this.octokit = null;
    this.owner = null;
    this.repo = null;
  }

  async run() {
    try {
      console.log(chalk.cyan('\n╔════════════════════════════════════════════════════════════╗'));
      console.log(chalk.cyan('║              Create Release Tag                           ║'));
      console.log(chalk.cyan('╚════════════════════════════════════════════════════════════╝\n'));

      // Get base branch if not provided
      if (!this.baseBranch) {
        const { branch } = await inquirer.prompt([
          {
            type: 'input',
            name: 'branch',
            message: 'Enter release branch name (e.g., release/v1.23):',
            validate: (input) => {
              if (!input || input.trim() === '') {
                return 'Branch name is required';
              }
              return true;
            }
          }
        ]);
        this.baseBranch = branch;
      }

      console.log(chalk.green(`\nBase branch: ${this.baseBranch}`));

      // Initialize GitHub client (will load token automatically)
      this.octokit = await GitHubUtils.initOctokit(this.githubToken);
      
      // Verify token
      const verification = await GitHubUtils.verifyToken(this.octokit);
      if (!verification.valid) {
        throw new Error('Invalid GitHub token. Please run "cggit setup" to update your token.');
      }
      console.log(chalk.gray(`Authenticated as: ${verification.user.login}`));

      // Parse repository info
      const repoInfo = await GitHubUtils.parseRepositoryInfo();
      this.owner = repoInfo.owner;
      this.repo = repoInfo.repo;
      console.log(chalk.gray(`Repository: ${this.owner}/${this.repo}`));

      // Fetch latest tags (force to avoid conflicts)
      console.log(chalk.yellow('\nFetching latest tags from remote...'));
      try {
        await this.git.fetch(['--tags', '--force']);
      } catch (error) {
        // Ignore fetch errors, we can still work with local tags
        console.log(chalk.gray('  Note: Some tags could not be fetched (this is usually fine)'));
      }

      if (!this.branchVersion) {
        // Extract version from branch name (e.g., release/v1.23 -> v1.23)
        const branchVersionMatch = this.baseBranch.match(/release\/v(\d+\.\d+)$/);
        if (!branchVersionMatch) {
          throw new Error(`Branch name must match format: release/v1.23 (got: ${this.baseBranch})`);
        }
        const branchVersion = branchVersionMatch[1]; // e.g., "1.23"
        this.branchVersion = branchVersion;
      }

      // Find latest tag for this branch version
      const latestTag = await this.findLatestTagForBranch(this.branchVersion);
      
      let version;
      
      // If version is provided via option, use it
      if (this.version) {
        version = this.version;
        console.log(chalk.cyan(`\nUsing specified version: ${version}`));
        
        // Validate the provided version
        const pattern = /^v\d+\.\d+\.\d+$/;
        if (!pattern.test(version)) {
          throw new Error(`Version must match format: v1.23.5 (got: ${version})`);
        }
        const versionMatch = version.match(/^v(\d+\.\d+)\.\d+$/);
        if (!versionMatch || versionMatch[1] !== this.branchVersion ) {
          throw new Error(`Version must start with v${this.branchVersion} (branch: release/v${branchVersion}, got: ${version})`);
        }
        
        if (latestTag) {
          console.log(chalk.gray(`  Latest tag: ${latestTag}`));
        }
      } else {
        // Auto-generate from latest tag
        if (latestTag) {
          console.log(chalk.green(`✓ Latest tag for v${this.branchVersion}: ${latestTag}`));
          version = this.incrementVersion(latestTag);
          console.log(chalk.cyan(`\nAuto-generated version: ${version}`));
        } else {
          console.log(chalk.yellow(`⚠ No existing tags found for v${this.branchVersion}`));
          version = `v${this.branchVersion}.0`;
          console.log(chalk.cyan(`\nAuto-generated version: ${version}`));
        }
      }

      // Confirm
      console.log('');
      console.log(chalk.yellow('Summary:'));
      console.log(chalk.gray(`  Branch: ${this.baseBranch}`));
      console.log(chalk.gray(`  Tag: ${version}`));
      if (this.octokit) {
        console.log(chalk.gray(`  Release notes: Auto-generated from commits`));
        console.log(chalk.gray(`  Previous tag: ${latestTag || 'none'}`));
        console.log(chalk.gray(`  Draft: ${this.draft ? 'Yes' : 'No'}`));
      }
      if (this.helm) {
        console.log(chalk.gray(`  Generate Helm: Yes (version: ${version.replace(/^v/, '')})`));
      }
      console.log('');

      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Create this release tag?',
          default: false
        }
      ]);

      if (!confirm) {
        console.log(chalk.yellow('\nRelease creation cancelled'));
        return;
      }

      // Verify GitHub token is available
      if (!this.octokit || !this.owner || !this.repo) {
        throw new Error('GitHub token is required to create releases. Run "cggit setup" first.');
      }

      // Create GitHub Release (this will also create the tag)
      console.log(chalk.yellow(`\nCreating GitHub Release ${version}...`));
      console.log(chalk.gray('  Auto-generating release notes from commits...'));
      
      try {
        const release = await this.createGitHubRelease(version, latestTag);
        
        // Success
        console.log('');
        console.log(chalk.green('════════════════════════════════════════════════════════════'));
        if (this.draft) {
          console.log(chalk.green(`✓ GitHub Draft Release ${version} created successfully!`));
        } else {
          console.log(chalk.green(`✓ GitHub Release ${version} created successfully!`));
        }
        console.log(chalk.green('════════════════════════════════════════════════════════════'));
        console.log('');
        console.log(chalk.gray(`Tag: ${version}`));
        console.log(chalk.gray(`Branch: ${this.baseBranch}`));
        console.log(chalk.gray(`Status: ${this.draft ? 'Draft' : 'Published'}`));
        console.log(chalk.gray(`URL: ${release.html_url}`));
        console.log('');
        
        // Fetch the new tag locally
        console.log(chalk.yellow('Fetching new tag to local repository...'));
        try {
          await this.git.fetch(['--tags', '--force']);
          console.log(chalk.green('✓ Tag synced locally'));
        } catch (error) {
          console.log(chalk.gray('  Note: Tag fetch had some issues, but release was created successfully'));
        }
        console.log('');

        // Generate Helm chart if requested
        if (this.helm) {
          await this.generateHelmChart(version);
        }
        
      } catch (error) {
        throw new Error(`Failed to create GitHub Release: ${error.message}`);
      }

    } catch (error) {
      console.error(chalk.red(`\nError: ${error.message}`));
      throw error;
    }
  }

  async findLatestTagForBranch(branchVersion) {
    // branchVersion is like "1.23"
    // Find tags like v1.23.0, v1.23.1, v1.23.2, etc.
    try {
      // Get all tags
      await this.git.fetch();
      const tags = await this.git.tags();
      
      // Filter tags with format: v1.23.x
      const prefix = `v${branchVersion}.`;
      const matchingTags = tags.all.filter(tag => tag.startsWith(prefix));
      
      if (matchingTags.length === 0) {
        return null;
      }

      // Sort tags by patch version number
      const sortedTags = matchingTags.sort((a, b) => {
        const versionA = this.parseVersion(a);
        const versionB = this.parseVersion(b);
        
        if (versionA.major !== versionB.major) {
          return versionB.major - versionA.major;
        }
        if (versionA.minor !== versionB.minor) {
          return versionB.minor - versionA.minor;
        }
        return versionB.patch - versionA.patch;
      });

      return sortedTags[0];
    } catch (error) {
      console.log(chalk.yellow(`Warning: Could not fetch tags: ${error.message}`));
      return null;
    }
  }

  parseVersion(tag) {
    // Parse tag like "v1.2.3" to { major: 1, minor: 2, patch: 3 }
    const match = tag.match(/^v(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
      return { major: 0, minor: 0, patch: 0 };
    }
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10)
    };
  }

  incrementVersion(tag) {
    // Increment patch version by default
    // v1.2.3 -> v1.2.4
    const version = this.parseVersion(tag);
    
    return `v${version.major}.${version.minor}.${version.patch + 1}`;
  }

  async createGitHubRelease(tagName, previousTag) {
    try {
      const releaseData = {
        owner: this.owner,
        repo: this.repo,
        tag_name: tagName,
        name: tagName,
        generate_release_notes: true,
        target_commitish: this.baseBranch,
        make_latest: this.latest, // Do not set as latest release by default
        draft: this.draft // Create as draft if flag is set
      };

      // If there's a previous tag, use it for generating notes
      if (previousTag) {
        releaseData.previous_tag_name = previousTag;
      }

      const { data } = await this.octokit.repos.createRelease(releaseData);
      return data;
    } catch (error) {
      throw new Error(`Failed to create GitHub Release: ${error.message}`);
    }
  }

  async generateHelmChart(version) {
    try {
      console.log(chalk.yellow('\n════════════════════════════════════════════════════════════'));
      console.log(chalk.yellow('Triggering Helm Chart Workflow'));
      console.log(chalk.yellow('════════════════════════════════════════════════════════════\n'));

      // Extract version without 'v' prefix (v1.23.5 -> 1.23.5)
      const helmVersion = version.replace(/^v/, '');
      console.log(chalk.cyan(`Helm chart version: ${helmVersion}`));

      const workflowFile = 'helm-chart.yml';
      
      try {
        // Trigger GitHub Actions workflow
        console.log(chalk.yellow(`\nTriggering workflow: ${workflowFile}...`));
        
        await this.octokit.actions.createWorkflowDispatch({
          owner: this.owner,
          repo: this.repo,
          workflow_id: workflowFile,
          ref: this.baseBranch,
          inputs: {
            version: helmVersion
          }
        });

        console.log(chalk.green('✓ Workflow triggered successfully!'));

        console.log('');
        console.log(chalk.green('════════════════════════════════════════════════════════════'));
        console.log(chalk.green('✓ Helm chart workflow triggered!'));
        console.log(chalk.green('════════════════════════════════════════════════════════════'));
        console.log('');
        console.log(chalk.gray(`Workflow: ${workflowFile}`));
        console.log(chalk.gray(`Branch: ${this.baseBranch}`));
        console.log(chalk.gray(`Version: ${helmVersion}`));
        console.log(chalk.gray(`\nCheck workflow status: https://github.com/${this.owner}/${this.repo}/actions`));
        console.log('');

      } catch (error) {
        if (error.status === 404) {
          console.log(chalk.red(`✗ Workflow '${workflowFile}' not found`));
          console.log(chalk.yellow('  Skipping helm chart generation...'));
        } else {
          console.log(chalk.red(`✗ Failed to trigger helm workflow: ${error.message}`));
          console.log(chalk.yellow('  Continuing without helm chart generation...'));
        }
      }

    } catch (error) {
      console.log(chalk.yellow(`⚠ Helm chart workflow trigger failed: ${error.message}`));
    }
  }
}

module.exports = ReleaseCreator;

