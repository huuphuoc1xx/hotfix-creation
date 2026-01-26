const { Octokit } = require('@octokit/rest');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const simpleGit = require('simple-git');

class GitHubUtils {
  /**
   * Load GitHub token from file or environment variable
   */
  static async loadToken(providedToken) {
    // If token already provided, use it
    if (providedToken) {
      return providedToken;
    }

    // Check environment variable
    if (process.env.GITHUB_TOKEN) {
      return process.env.GITHUB_TOKEN;
    }

    // Try to load from saved file
    try {
      const tokenFile = path.join(os.homedir(), '.create-hotfix', 'github-token');
      const token = await fs.readFile(tokenFile, 'utf-8');
      return token.trim();
    } catch (error) {
      // File doesn't exist or can't be read
      return null;
    }
  }

  /**
   * Parse repository owner and name from git remote
   */
  static async parseRepositoryInfo() {
    try {
      const git = simpleGit();
      const remotes = await git.getRemotes(true);
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
        return { owner: match[1], repo: match[2] };
      }

      // Try HTTPS format: https://github.com/owner/repo.git
      match = url.match(/https:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/);
      if (match) {
        return { owner: match[1], repo: match[2] };
      }

      throw new Error('Could not parse GitHub repository URL');
    } catch (error) {
      throw new Error(`Failed to parse repository info: ${error.message}`);
    }
  }

  /**
   * Initialize Octokit with token
   */
  static async initOctokit(providedToken) {
    const token = await GitHubUtils.loadToken(providedToken);
    
    if (!token) {
      throw new Error('GitHub token not found. Please run "cggit setup" first, or set GITHUB_TOKEN environment variable, or use --token option.');
    }

    return new Octokit({ auth: token });
  }

  /**
   * Verify GitHub token is valid
   */
  static async verifyToken(octokit) {
    try {
      const { data: user } = await octokit.users.getAuthenticated();
      return { valid: true, user };
    } catch (error) {
      if (error.status === 401) {
        return { valid: false, error: 'Invalid or expired token' };
      }
      throw error;
    }
  }
}

module.exports = GitHubUtils;

