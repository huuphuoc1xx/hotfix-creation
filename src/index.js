const simpleGit = require('simple-git');
const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs').promises;
const path = require('path');

class HotfixBranchCreator {
  constructor(options = {}) {
    this.git = simpleGit();
    this.noPush = options.noPush || false;
    this.yes = options.yes || false;
    this.qaBranch = options.qaBranch;
    this.uatBranch = options.uatBranch;
    this.preProdBranch = options.preProdBranch;
    this.prodBranch = options.prodBranch;
  }

  async run() {
    try {
      // Get current branch name
      const currentBranch = await this.getCurrentBranch();
      console.log(chalk.green(`Current branch: ${currentBranch}`));

      // Check we're not on dev branch
      if (currentBranch === 'dev') {
        throw new Error('You are currently on dev branch. Please switch to your feature branch first.');
      }

      // Fetch latest changes first (needed to auto-checkout remote branches)
      console.log(chalk.yellow('Fetching latest changes...'));
      await this.git.fetch('origin');

      // Ensure branches exist locally (auto checkout from origin if not)
      await this.ensureLocalBranch('dev');
      if (this.qaBranch) {
        await this.ensureLocalBranch(this.qaBranch);
      }
      if (this.uatBranch) {
        await this.ensureLocalBranch(this.uatBranch);
      }
      if (this.preProdBranch) {
        await this.ensureLocalBranch(this.preProdBranch);
      }
      if (this.prodBranch) {
        await this.ensureLocalBranch(this.prodBranch);
      }

      // Return to current branch (ensureLocalBranch may have checked out another branch)
      await this.git.checkout(currentBranch);

      // Get list of commits
      let commits = await this.getCommitsBetween('origin/dev', currentBranch);
      
      if (commits.length === 0) {
        commits = await this.getCommitsBetween('dev', currentBranch);
        if (commits.length === 0) {
          throw new Error(`No commits found between dev and ${currentBranch}`);
        }
      }

      console.log(chalk.green(`Found ${commits.length} commit(s) to cherry-pick`));
      
      // Display commits
      console.log(chalk.yellow('Commits to be cherry-picked:'));
      const log = await this.git.log(['origin/dev..' + currentBranch]);
      log.all.forEach(commit => {
        console.log(`  ${commit.hash.substring(0, 7)} ${commit.message}`);
      });

      // Create hotfix branch names
      const hotfixQaBranch = this.qaBranch ? `${currentBranch}-for-qa` : null;
      const hotfixUatBranch = this.uatBranch ? `${currentBranch}-for-uat` : null;
      const hotfixPreProdBranch = this.preProdBranch ? `${currentBranch}-for-pre-prod` : null;
      const hotfixProdBranch = this.prodBranch ? `${currentBranch}-for-prod` : null;

      console.log('');
      console.log(chalk.yellow('Will create the following branches:'));
      if (hotfixQaBranch) {
        console.log(chalk.green(`  - ${hotfixQaBranch} (from ${this.qaBranch})`));
      }
      if (hotfixUatBranch) {
        console.log(chalk.green(`  - ${hotfixUatBranch} (from ${this.uatBranch})`));
      }
      if (hotfixPreProdBranch) {
        console.log(chalk.green(`  - ${hotfixPreProdBranch} (from ${this.preProdBranch})`));
      }
      if (hotfixProdBranch) {
        console.log(chalk.green(`  - ${hotfixProdBranch} (from ${this.prodBranch})`));
      }
      console.log('');

      // Confirm
      let proceed = this.yes;
      if (!proceed) {
        const answer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: 'Do you want to proceed?',
            default: false
          }
        ]);
        proceed = answer.proceed;
      }

      if (!proceed) {
        console.log(chalk.yellow('Operation cancelled'));
        return;
      }

      // Create hotfix branches
      let qaResult = { success: false, skipped: true };
      let uatResult = { success: false, skipped: true };
      let preProdResult = { success: false, skipped: true };
      let prodResult = { success: false, skipped: true };

      if (hotfixQaBranch) {
        qaResult = await this.createHotfixBranch(
          this.qaBranch,
          hotfixQaBranch,
          commits
        );
      }

      if (hotfixUatBranch) {
        uatResult = await this.createHotfixBranch(
          this.uatBranch,
          hotfixUatBranch,
          commits
        );
      }

      if (hotfixPreProdBranch) {
        preProdResult = await this.createHotfixBranch(
          this.preProdBranch,
          hotfixPreProdBranch,
          commits
        );
      }

      if (hotfixProdBranch) {
        prodResult = await this.createHotfixBranch(
          this.prodBranch,
          hotfixProdBranch,
          commits
        );
      }

      // Return to original branch
      console.log('');
      console.log(chalk.yellow(`Returning to original branch: ${currentBranch}`));
      await this.git.checkout(currentBranch);

      // Summary
      await this.printSummary(qaResult, uatResult, preProdResult, prodResult, hotfixQaBranch, hotfixUatBranch, hotfixPreProdBranch, hotfixProdBranch);

    } catch (error) {
      console.error(chalk.red(`Error: ${error.message}`));
      throw error;
    }
  }

  async getCurrentBranch() {
    const status = await this.git.status();
    return status.current;
  }

  async ensureLocalBranch(branchName) {
    const existsLocally = await this.branchExists(branchName);
    if (existsLocally) {
      return;
    }
    const remoteRef = `origin/${branchName}`;
    try {
      await this.git.revparse(['--verify', remoteRef]);
    } catch {
      throw new Error(`Branch '${branchName}' does not exist locally or on origin`);
    }
    console.log(chalk.yellow(`Branch ${branchName} not found locally, checking out from origin...`));
    await this.git.checkout(['-b', branchName, remoteRef]);
    console.log(chalk.green(`✓ Checked out ${branchName} from origin`));
  }

  async getCommitsBetween(baseBranch, targetBranch) {
    const log = await this.git.log([`${baseBranch}..${targetBranch}`, '--reverse']);
    return log.all.map(commit => ({
      hash: commit.hash,
      message: commit.message
    }));
  }

  async createHotfixBranch(baseBranch, hotfixBranch, commits) {
    console.log('');
    console.log(chalk.green('========================================'));
    console.log(chalk.green(`Creating hotfix branch: ${hotfixBranch}`));
    console.log(chalk.green('========================================'));

    try {
      // Check if branch already exists
      const branchExists = await this.branchExists(hotfixBranch);
      if (branchExists) {
        console.log(chalk.yellow(`Warning: Branch ${hotfixBranch} already exists`));
        let recreate = this.yes;
        if (!recreate) {
          const answer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'recreate',
              message: 'Do you want to delete and recreate it?',
              default: false
            }
          ]);
          recreate = answer.recreate;
        }

        if (recreate) {
          await this.git.branch(['-D', hotfixBranch]);
          console.log(chalk.green('Deleted existing branch'));
        } else {
          console.log(chalk.yellow(`Skipping ${hotfixBranch}`));
          return { success: false, skipped: true };
        }
      }

      // Checkout base branch and update
      console.log(chalk.yellow(`Checking out ${baseBranch}...`));
      await this.git.checkout(baseBranch);
      await this.git.pull('origin', baseBranch);

      // Create hotfix branch
      console.log(chalk.yellow(`Creating branch ${hotfixBranch}...`));
      await this.git.checkoutLocalBranch(hotfixBranch);

      // Cherry-pick commits
      console.log(chalk.yellow('Cherry-picking commits...'));
      for (const commit of commits) {
        console.log(chalk.yellow(`Cherry-picking: ${commit.hash.substring(0, 7)} ${commit.message}`));
        
        try {
          // Try cherry-pick
          await this.git.raw(['cherry-pick', '--no-commit', commit.hash]);
          
          // Handle package.json versions
          await this.restorePackageJsonVersions();
          
          // Stage all changes
          await this.git.add('-A');
          
          // Commit if there are changes
          const status = await this.git.status();
          if (status.staged.length > 0) {
            await this.git.commit(commit.message, ['--no-verify']);
            console.log(chalk.green('  ✓ Committed successfully'));
          } else {
            console.log(chalk.yellow('  ⊘ Skipping commit - only package.json versions were changed'));
          }
          
        } catch (error) {
          // Handle conflicts
          console.log(chalk.yellow('Conflicts detected, attempting to resolve...'));
          
          const resolved = await this.resolveConflicts();
          
          if (!resolved) {
            console.log(chalk.red('Error: Cherry-pick has conflicts that require manual resolution'));
            console.log(chalk.yellow('Please resolve conflicts manually, then run:'));
            console.log('  git add <resolved-files>');
            console.log('  git cherry-pick --continue');
            console.log('Or abort with:');
            console.log('  git cherry-pick --abort');
            return { success: false, hasConflicts: true };
          }
          
          // After resolving conflicts, restore package.json and commit
          await this.restorePackageJsonVersions();
          await this.git.add('-A');
          
          const status = await this.git.status();
          if (status.staged.length > 0) {
            await this.git.commit(commit.message, ['--no-verify']);
            console.log(chalk.green('  ✓ Committed successfully after resolving conflicts'));
          }
        }
      }

      console.log(chalk.green(`Successfully created ${hotfixBranch} with all commits`));
      return { success: true, branch: hotfixBranch };

    } catch (error) {
      console.error(chalk.red(`Error creating ${hotfixBranch}: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  async branchExists(branchName) {
    try {
      await this.git.revparse(['--verify', branchName]);
      return true;
    } catch {
      return false;
    }
  }

  async restorePackageJsonVersions() {
    console.log(chalk.yellow('Ensuring package.json versions match base branch...'));
    
    try {
      // Find all changed package.json files
      const diff = await this.git.diff(['--name-only', 'HEAD']);
      const packageFiles = diff.split('\n').filter(file => file.endsWith('package.json'));
      
      for (const pkgFile of packageFiles) {
        if (pkgFile) {
          console.log(chalk.yellow(`  - Restoring original version in ${pkgFile}`));
          try {
            await this.git.checkout(['HEAD', '--', pkgFile]);
          } catch (error) {
            // Ignore error if file doesn't exist
          }
        }
      }
    } catch (error) {
      // Ignore error if no changes
    }
  }

  async resolveConflicts() {
    try {
      // Get list of conflicted files
      const status = await this.git.status();
      const conflictedFiles = status.conflicted;
      
      if (conflictedFiles.length === 0) {
        return true;
      }

      let hasUnresolvableConflict = false;

      for (const conflictFile of conflictedFiles) {
        if (conflictFile.includes('package.json')) {
          console.log(chalk.yellow(`  - Checking conflict in ${conflictFile}...`));
          
          // Read file and analyze conflicts
          const content = await fs.readFile(conflictFile, 'utf-8');
          const isVersionConflictOnly = this.isVersionConflictOnly(content);
          
          if (isVersionConflictOnly) {
            console.log(chalk.green('    ✓ Conflict is version-only, auto-resolving (keeping base version)'));
            await this.git.checkout(['--ours', conflictFile]);
            await this.git.add(conflictFile);
          } else {
            console.log(chalk.red('    ✗ Conflict includes non-version changes, manual resolution required'));
            hasUnresolvableConflict = true;
          }
        } else {
          console.log(chalk.red(`  - Conflict in ${conflictFile} requires manual resolution`));
          hasUnresolvableConflict = true;
        }
      }

      return !hasUnresolvableConflict;
    } catch (error) {
      return false;
    }
  }

  isVersionConflictOnly(content) {
    const lines = content.split('\n');
    let inConflict = false;
    let hasVersionInConflict = false;
    let hasOtherInConflict = false;

    for (const line of lines) {
      if (line.startsWith('<<<<<<<')) {
        inConflict = true;
        hasVersionInConflict = false;
        hasOtherInConflict = false;
      } else if (line.startsWith('>>>>>>>')) {
        inConflict = false;
        if (hasOtherInConflict) {
          return false;
        }
      } else if (inConflict && !line.startsWith('=======') && !line.startsWith('|||||||')) {
        if (line.includes('"version"')) {
          hasVersionInConflict = true;
        } else {
          const trimmed = line.trim();
          if (trimmed && trimmed !== '{' && trimmed !== '}' && trimmed !== ',') {
            hasOtherInConflict = true;
          }
        }
      }
    }

    return !hasOtherInConflict;
  }

  async printSummary(qaResult, uatResult, preProdResult, prodResult, hotfixQaBranch, hotfixUatBranch, hotfixPreProdBranch, hotfixProdBranch) {
    console.log('');
    console.log(chalk.green('========================================'));
    console.log(chalk.green('Summary'));
    console.log(chalk.green('========================================'));

    const branchesToPush = [];

    if (qaResult.success) {
      console.log(chalk.green(`✓ QA hotfix branch created: ${hotfixQaBranch}`));
      branchesToPush.push(hotfixQaBranch);
    } else if (hotfixQaBranch) {
      console.log(chalk.red('✗ QA hotfix branch failed or skipped'));
    }

    if (uatResult.success) {
      console.log(chalk.green(`✓ UAT hotfix branch created: ${hotfixUatBranch}`));
      branchesToPush.push(hotfixUatBranch);
    } else if (hotfixUatBranch) {
      console.log(chalk.red('✗ UAT hotfix branch failed or skipped'));
    }

    if (preProdResult.success) {
      console.log(chalk.green(`✓ PRE-PROD hotfix branch created: ${hotfixPreProdBranch}`));
      branchesToPush.push(hotfixPreProdBranch);
    } else if (hotfixPreProdBranch) {
      console.log(chalk.red('✗ PRE-PROD hotfix branch failed or skipped'));
    }

    if (prodResult.success) {
      console.log(chalk.green(`✓ PROD hotfix branch created: ${hotfixProdBranch}`));
      branchesToPush.push(hotfixProdBranch);
    } else if (hotfixProdBranch) {
      console.log(chalk.red('✗ PROD hotfix branch failed or skipped'));
    }

    // Push branches if not in no-push mode
    if (!this.noPush && branchesToPush.length > 0) {
      console.log('');
      console.log(chalk.yellow('========================================'));
      console.log(chalk.yellow('Push to Remote'));
      console.log(chalk.yellow('========================================'));
      console.log(chalk.yellow('The following branches will be pushed:'));
      branchesToPush.forEach(branch => {
        console.log(chalk.green(`  - ${branch}`));
      });
      console.log('');

      let pushConfirm = this.yes;
      if (!pushConfirm) {
        const answer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'pushConfirm',
            message: 'Do you want to push these branches to remote?',
            default: false
          }
        ]);
        pushConfirm = answer.pushConfirm;
      }

      if (pushConfirm) {
        for (const branch of branchesToPush) {
          console.log(chalk.yellow(`Pushing ${branch}...`));
          try {
            await this.git.push('origin', branch, ['-f', '--no-verify']);
            console.log(chalk.green(`✓ Successfully pushed ${branch}`));
          } catch (error) {
            console.log(chalk.red(`✗ Failed to push ${branch}`));
          }
        }
      } else {
        console.log(chalk.yellow('Push cancelled. You can push manually later with:'));
        branchesToPush.forEach(branch => {
          console.log(`  git push origin ${branch} -f --no-verify`);
        });
      }
    } else if (this.noPush && branchesToPush.length > 0) {
      console.log('');
      console.log(chalk.yellow('Branches created but not pushed (--no-push mode)'));
      console.log(chalk.yellow('To push manually, run:'));
      branchesToPush.forEach(branch => {
        console.log(`  git push origin ${branch} -f`);
      });
    }

    console.log('');
    console.log(chalk.green('Done!'));
  }
}

module.exports = HotfixBranchCreator;

