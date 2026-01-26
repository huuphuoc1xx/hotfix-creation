const simpleGit = require('simple-git');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class PullRequestCreator {
  constructor(options = {}) {
    this.git = simpleGit();
    this.devPrNumber = options.devPrNumber;
    this.qaBranch = options.qaBranch;
    this.uatBranch = options.uatBranch;
    this.githubToken = options.githubToken || process.env.GITHUB_TOKEN;
    this.octokit = null;
    this.owner = null;
    this.repo = null;
  }

  async loadToken() {
    // If token already provided, use it
    if (this.githubToken) {
      return this.githubToken;
    }

    // Try to load from saved file
    try {
      const tokenFile = path.join(os.homedir(), '.create-hotfix', 'github-token');
      const token = await fs.readFile(tokenFile, 'utf-8');
      this.githubToken = token.trim();
      return this.githubToken;
    } catch (error) {
      // File doesn't exist or can't be read
      return null;
    }
  }

  async run() {
    try {
      // Load GitHub token
      await this.loadToken();
      
      if (!this.githubToken) {
        throw new Error('GitHub token not found. Please run "setup-token" command first, or set GITHUB_TOKEN environment variable, or use --token option.');
      }

      this.octokit = new Octokit({ auth: this.githubToken });

      // Verify token is valid by checking authentication
      try {
        const { data: user } = await this.octokit.users.getAuthenticated();
        console.log(chalk.gray(`Authenticated as: ${user.login}`));
      } catch (error) {
        if (error.status === 401) {
          console.log('');
          console.log(chalk.red('❌ GitHub token is invalid or expired'));
          console.log('');
          console.log(chalk.yellow('Please run: cggit setup-token'));
          console.log('');
          throw new Error('Invalid GitHub token. Please setup a valid token.');
        }
        throw error;
      }

      // Get current branch
      const currentBranch = await this.getCurrentBranch();
      console.log(chalk.green(`Current branch: ${currentBranch}`));

      // Parse repository info from remote FIRST (needed for GitHub API calls)
      await this.parseRepositoryInfo();
      console.log(chalk.green(`Repository: ${this.owner}/${this.repo}`));

      // Try to extract DEV PR number from branch name if not provided
      if (!this.devPrNumber) {
        this.devPrNumber = await this.findPrByBranch(currentBranch);
        if (this.devPrNumber) {
          console.log(chalk.yellow(`Detected DEV PR #${this.devPrNumber} from branch name`));
        } else {
          console.log('');
          console.log(chalk.red('❌ Could not detect DEV PR number from branch name.'));
          console.log('');
          console.log(chalk.yellow('Possible reasons:'));
          console.log(chalk.gray('  1. Current branch has no associated PR on GitHub'));
          console.log(chalk.gray(`  2. Current branch: "${currentBranch}" (main/master branches typically have no PR)`));
          console.log(chalk.gray('  3. GitHub token may not have access to this repository'));
          console.log('');
          console.log(chalk.yellow('Solutions:'));
          console.log(chalk.gray('  1. Switch to a feature branch that has a PR'));
          console.log(chalk.gray('  2. Or manually provide the DEV PR number: --dev-pr <PR_NUMBER>'));
          console.log('');
          throw new Error('DEV PR number is required. Use --dev-pr option or switch to a branch with an existing PR.');
        }
      }

      // Get DEV PR details
      console.log(chalk.yellow(`\nFetching DEV PR #${this.devPrNumber}...`));
      const devPr = await this.getPullRequest(this.devPrNumber);
      
      if (!devPr) {
        throw new Error(`DEV PR #${this.devPrNumber} not found`);
      }

      console.log(chalk.green(`✓ Found DEV PR: ${devPr.title}`));

      // Create hotfix branch names
      const hotfixQaBranch = this.qaBranch ? `${currentBranch}-for-qa` : null;
      const hotfixUatBranch = this.uatBranch ? `${currentBranch}-for-uat` : null;

      // Verify hotfix branches exist
      if (hotfixQaBranch) {
        await this.verifyBranchExists(hotfixQaBranch);
      }
      if (hotfixUatBranch) {
        await this.verifyBranchExists(hotfixUatBranch);
      }

      console.log('');
      console.log(chalk.yellow('Will create PRs for:'));
      if (hotfixQaBranch) {
        console.log(chalk.green(`  - ${hotfixQaBranch} → ${this.qaBranch}`));
      }
      if (hotfixUatBranch) {
        console.log(chalk.green(`  - ${hotfixUatBranch} → ${this.uatBranch}`));
      }
      console.log('');

      // Confirm
      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Do you want to proceed with PR creation?',
          default: false
        }
      ]);

      if (!proceed) {
        console.log(chalk.yellow('Operation cancelled'));
        return;
      }

      // Create PRs
      const results = [];

      if (hotfixQaBranch) {
        console.log('');
        console.log(chalk.yellow(`Creating PR for ${hotfixQaBranch}...`));
        const qaPr = await this.createPullRequest(
          hotfixQaBranch,
          this.qaBranch,
          devPr,
          'QA'
        );
        results.push({ type: 'QA', pr: qaPr, branch: hotfixQaBranch });
      }

      if (hotfixUatBranch) {
        console.log('');
        console.log(chalk.yellow(`Creating PR for ${hotfixUatBranch}...`));
        const uatPr = await this.createPullRequest(
          hotfixUatBranch,
          this.uatBranch,
          devPr,
          'UAT'
        );
        results.push({ type: 'UAT', pr: uatPr, branch: hotfixUatBranch });
      }

      // Print summary
      this.printSummary(results);

    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      throw error;
    }
  }

  async getCurrentBranch() {
    const status = await this.git.status();
    return status.current;
  }

  async findPrByBranch(branchName) {
    try {
      console.log(chalk.gray(`  Searching GitHub PRs for branch: ${branchName}...`));
      console.log(chalk.gray(`  Repository: ${this.owner}/${this.repo}`));
      
      // Verify we have owner and repo
      if (!this.owner || !this.repo) {
        console.log(chalk.yellow(`  Warning: Repository info not available yet`));
        return null;
      }

      // Search for open PRs first
      const { data: openPrs } = await this.octokit.pulls.list({
        owner: this.owner,
        repo: this.repo,
        state: 'open',
        head: `${this.owner}:${branchName}`,
        per_page: 1
      });

      if (openPrs.length > 0) {
        return openPrs[0].number;
      }

      // If not found in open PRs, search closed/merged PRs
      console.log(chalk.gray(`  Not found in open PRs, searching closed/merged PRs...`));
      const { data: closedPrs } = await this.octokit.pulls.list({
        owner: this.owner,
        repo: this.repo,
        state: 'closed',
        head: `${this.owner}:${branchName}`,
        per_page: 1,
        sort: 'updated',
        direction: 'desc'
      });

      if (closedPrs.length > 0) {
        return closedPrs[0].number;
      }

      // If still not found, try searching all PRs (in case of fork)
      console.log(chalk.gray(`  Searching all PRs...`));
      const { data: allPrs } = await this.octokit.pulls.list({
        owner: this.owner,
        repo: this.repo,
        state: 'all',
        per_page: 100,
        sort: 'updated',
        direction: 'desc'
      });

      // Find PR with matching head branch
      for (const pr of allPrs) {
        if (pr.head.ref === branchName) {
          return pr.number;
        }
      }

      return null;
    } catch (error) {
      console.log(chalk.yellow(`  Warning: Error searching for PR: ${error.message}`));
      if (error.status === 404) {
        console.log(chalk.yellow(`  This may indicate: repository not found, no access, or incorrect token permissions`));
      }
      return null;
    }
  }

  async parseRepositoryInfo() {
    try {
      const remotes = await this.git.getRemotes(true);
      const origin = remotes.find(r => r.name === 'origin');
      
      if (!origin) {
        throw new Error('No origin remote found');
      }

      // Parse GitHub URL (supports both HTTPS and SSH)
      const url = origin.refs.fetch;
      let match;
      
      // Try SSH format: git@github.com:owner/repo.git
      match = url.match(/git@github\.com:(.+?)\/(.+?)(?:\.git)?$/);
      if (match) {
        this.owner = match[1];
        this.repo = match[2];
        return;
      }

      // Try HTTPS format: https://github.com/owner/repo.git
      match = url.match(/https:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/);
      if (match) {
        this.owner = match[1];
        this.repo = match[2];
        return;
      }

      throw new Error('Could not parse GitHub repository URL');
    } catch (error) {
      throw new Error(`Failed to parse repository info: ${error.message}`);
    }
  }

  async verifyBranchExists(branchName) {
    try {
      await this.git.revparse(['--verify', branchName]);
    } catch (error) {
      throw new Error(`Branch '${branchName}' does not exist locally. Please create hotfix branches first.`);
    }
  }

  async getPullRequest(prNumber) {
    try {
      const { data } = await this.octokit.pulls.get({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber
      });
      return data;
    } catch (error) {
      if (error.status === 404) {
        console.log('');
        console.log(chalk.red(`❌ PR #${prNumber} not found in ${this.owner}/${this.repo}`));
        console.log('');
        console.log(chalk.yellow('Possible reasons:'));
        console.log(chalk.gray('  1. PR number is incorrect'));
        console.log(chalk.gray('  2. PR exists in a different repository'));
        console.log(chalk.gray('  3. GitHub token does not have access to this repository'));
        console.log(chalk.gray('  4. Repository is private and token lacks permissions'));
        console.log('');
        console.log(chalk.yellow('To verify:'));
        console.log(chalk.gray(`  1. Check if PR exists: https://github.com/${this.owner}/${this.repo}/pull/${prNumber}`));
        console.log(chalk.gray('  2. Verify your token has "repo" scope for private repos'));
        console.log(chalk.gray('  3. Run: cggit setup-token (to update your token)'));
        console.log('');
        return null;
      }
      if (error.status === 401) {
        console.log('');
        console.log(chalk.red('❌ Authentication failed'));
        console.log('');
        console.log(chalk.yellow('Your GitHub token is invalid or expired.'));
        console.log(chalk.gray('Please run: cggit setup-token'));
        console.log('');
        throw new Error('GitHub authentication failed. Please setup a valid token.');
      }
      if (error.status === 403) {
        console.log('');
        console.log(chalk.red('❌ Access forbidden'));
        console.log('');
        console.log(chalk.yellow('Your GitHub token does not have permission to access this repository.'));
        console.log(chalk.gray('Make sure your token has the "repo" scope for private repositories.'));
        console.log(chalk.gray('Run: cggit setup-token (to create a new token with correct permissions)'));
        console.log('');
        throw new Error('GitHub token lacks required permissions.');
      }
      throw error;
    }
  }

  async createPullRequest(headBranch, baseBranch, devPr, environment) {
    try {
      // Prepare PR body with DEV PR reference
      const prBody = this.preparePrBody(devPr, environment);

      // Create PR
      const { data } = await this.octokit.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title: devPr.title,
        head: headBranch,
        base: baseBranch,
        body: prBody
      });

      console.log(chalk.green(`✓ Created PR #${data.number}: ${data.html_url}`));
      return data;
    } catch (error) {
      if (error.status === 422) {
        console.log(chalk.yellow(`⚠ PR may already exist or no commits to create PR`));
        return null;
      }
      throw new Error(`Failed to create PR: ${error.message}`);
    }
  }

  preparePrBody(devPr, environment) {
    const lines = [];
    
    // Add original PR body if exists
    if (devPr.body && devPr.body.trim()) {
      lines.push(devPr.body.trim());
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // Add environment info
    lines.push(`**Environment:** ${environment}`);
    lines.push('');

    // Add DEV PR reference
    lines.push(`**DEV PR:** #${devPr.number}`);

    return lines.join('\n');
  }

  printSummary(results) {
    console.log('');
    console.log(chalk.green('========================================'));
    console.log(chalk.green('Summary'));
    console.log(chalk.green('========================================'));

    for (const result of results) {
      if (result.pr) {
        console.log(chalk.green(`✓ ${result.type} PR created: ${result.pr.html_url}`));
        console.log(chalk.gray(`  Branch: ${result.branch} → ${result.pr.base.ref}`));
        console.log(chalk.gray(`  PR #${result.pr.number}: ${result.pr.title}`));
      } else {
        console.log(chalk.yellow(`⚠ ${result.type} PR creation skipped or failed`));
      }
    }

    console.log('');
    console.log(chalk.green('Done!'));
  }
}

module.exports = PullRequestCreator;

