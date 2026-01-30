# cggit - Complete Git Workflow Tool

CLI tool to automatically create hotfix branches for QA and UAT with cherry-picked commits from your feature branch, and create pull requests with a single command.

## Features

- ✅ **Save default branches** - Configure once, use everywhere
- ✅ Automatically create hotfix branches from QA, UAT, PRE-PROD, and PROD base branches
- ✅ Cherry-pick commits from current feature branch
- ✅ Auto-resolve conflicts in package.json (version conflicts only)
- ✅ Restore package.json versions to base branch versions
- ✅ Support automatic or manual push
- ✅ Colorful and easy-to-read interface
- ✅ Confirmation prompts before important operations
- ✅ Auto-detect DEV PR number from GitHub

## Installation

### Global installation

```bash
npm install -g create-hotfix-branches

# Or if publishing with different name:
npm install -g cggit
```

### Local installation in project

```bash
npm install --save-dev create-hotfix-branches
```

### Install from local directory

#### Quick Install (Windows)
```bash
# Just run the install script
install.bat
```

#### Quick Install (Mac/Linux)
```bash
# Make script executable and run
chmod +x install.sh
./install.sh
```

#### Manual Install
```bash
cd C:\Users\admin\Desktop\hotfix-creation
npm install
npm link

# Now use cggit anywhere
cggit --help
```

#### Install on Multiple Laptops

1. **Copy the folder** to the new laptop (via USB, network drive, or Git)
2. **Run the install script**:
   - Windows: Double-click `install.bat` or run in terminal
   - Mac/Linux: Run `./install.sh`
3. **Done!** The `cggit` command is now available globally

**Note**: Each laptop only needs to run the install script once. The GitHub token setup (`cggit setup`) is saved per-user and persists across sessions.

## Usage

### Command Structure

All functionality is available through the `cggit` command with subcommands:

```bash
cggit setup      # Setup GitHub token
cggit config     # Configure default branches (NEW! 🚀)
cggit hotfix     # Create hotfix branches
cggit pr         # Create pull requests
cggit release    # Create GitHub release
cggit helm       # Trigger helm chart update
```

### 🚀 Quick Start (Recommended Workflow)

```bash
# 1. Setup GitHub token (one time)
cggit setup

# 2. Configure default branches (one time)
cggit config
# Enter: qa-release-1.0, uat-release-1.0, pre-prod-release-1.0, prod-release-1.0

# 3. Now you can use shortcuts! 🎉
cggit hotfix -q -u --pre-prod -p
cggit pr -q -u --pre-prod -p

# That's it! No need to type branch names every time!
```

### Configure Default Branches (Recommended)

Save your default branches once and never type them again! 🚀

#### Option 1: Interactive Setup (All at once)

```bash
cggit config
```

This interactive command will ask for:
- QA branch name (e.g., `qa-release-1.0`)
- UAT branch name (e.g., `uat-release-1.0`)
- PRE-PROD branch name (e.g., `pre-prod-release-1.0`)
- PROD branch name (e.g., `prod-release-1.0`)

#### Option 2: Set Individual Branches (One at a time)

```bash
# Set QA branch only
cggit config -q qa-release-1.0

# Set UAT branch only
cggit config -u uat-release-1.0

# Set PRE-PROD branch only
cggit config --pre-prod pre-prod-release-1.0

# Set PROD branch only
cggit config -p prod-release-1.0

# Set multiple branches at once
cggit config -q qa-release-1.0 -u uat-release-1.0
```

**After configuration, you can use shortcuts:**

```bash
# Instead of typing full branch names:
cggit hotfix --qa qa-release-1.0 --uat uat-release-1.0 --pre-prod pre-prod-release-1.0 -p prod-release-1.0

# Just use flags:
cggit hotfix -q -u --pre-prod -p

# Same for PR creation:
cggit pr -q -u --pre-prod -p
```

**Additional options:**

```bash
# Show current configuration
cggit config --show

# Clear saved configuration
cggit config --clear
```

**Mix saved config with explicit values:**

```bash
# Use saved config for QA, UAT, PROD but override PRE-PROD
cggit hotfix -q -u --pre-prod pre-prod-release-2.0 -p
```

### Setup GitHub Token (First Time)

Before creating PRs, you need to set up a GitHub personal access token:

```bash
cggit setup
```

This interactive command offers multiple options:

#### Option 1: Browser Authorization (Recommended) 🚀
- **No copy/paste needed!**
- Opens GitHub in your browser
- Shows you a code to enter
- Automatically saves the token after authorization
- Simplest and most secure method

#### Option 2: Manual Token Entry
- Enter an existing personal access token
- Useful if you already have a token

#### Option 3: Create Token Manually
- Opens GitHub token creation page
- You create and copy the token yourself
- Run the command again to save it

#### Additional options:

```bash
# Verify your existing token
cggit setup --verify

# Show your saved token
cggit setup --show

# Clear saved token
cggit setup --clear
```

### Create Hotfix Branches

#### Basic syntax

```bash
cggit hotfix [--qa [branch]] [--uat [branch]] [--pre-prod [branch]] [--prod [branch]] [options]
```

### Examples

```bash
# Using saved config (recommended - after running 'cggit config')
cggit hotfix -q -u --pre-prod -p

# Create hotfix branch for QA only (explicit branch name)
cggit hotfix --qa qa-release-1.0

# Create hotfix branch for UAT only
cggit hotfix --uat uat-release-1.0

# Create hotfix branch for PRE-PROD only
cggit hotfix --pre-prod pre-prod-release-1.0

# Create hotfix branches for all environments
cggit hotfix --qa qa-release-1.0 --uat uat-release-1.0 --pre-prod pre-prod-release-1.0 --prod prod-release-1.0

# Mix saved config with explicit values
cggit hotfix -q -u --pre-prod pre-prod-release-2.0 -p

# Create hotfix branches but don't push (for review first)
cggit hotfix -q -u --pre-prod -p --no-push
```

#### Options

- `-q, --qa [branch]`: QA branch name. Use flag only to use saved config, or provide branch name explicitly.
- `-u, --uat [branch]`: UAT branch name. Use flag only to use saved config, or provide branch name explicitly.
- `--pre-prod [branch]`: PRE-PROD branch name. Use flag only to use saved config, or provide branch name explicitly.
- `-p, --prod [branch]`: PROD branch name. Use flag only to use saved config, or provide branch name explicitly.
- `-n, --no-push`: Create branches but don't push to remote
- `-V, --version`: Display version
- `-h, --help`: Display help

**Note**: Must provide at least one environment

### Create Pull Requests

After creating hotfix branches, you can automatically create PRs that copy the DEV PR description.

#### Basic syntax

```bash
cggit pr [--dev-pr <number>] [--qa [branch]] [--uat [branch]] [--pre-prod [branch]] [--prod [branch]] [options]
```

#### Examples

```bash
# Using saved config (recommended - after running 'cggit config')
cggit pr -q -u --pre-prod -p

# Auto-detect PR number from GitHub (recommended)
cggit pr --qa qa-release-1.0

# Create PR for UAT only
cggit pr --uat uat-release-1.0

# Create PRs for all environments
cggit pr --qa qa-release-1.0 --uat uat-release-1.0 --pre-prod pre-prod-release-1.0 --prod prod-release-1.0

# Explicitly specify DEV PR number (skip auto-detection)
cggit pr --dev-pr 123 -q -u --pre-prod -p

# Mix saved config with explicit values
cggit pr -q -u --pre-prod pre-prod-release-2.0 -p

# With custom GitHub token
cggit pr --qa qa-release-1.0 --token ghp_xxxxx
```

**Auto-Detection via GitHub API:**

The tool automatically searches GitHub for PRs associated with your current branch:
- Searches **open PRs** first
- Falls back to **closed/merged PRs** if not found
- Searches **all recent PRs** as final fallback
- Works with any branch name (no naming convention required)

#### Options

- `-d, --dev-pr <number>`: DEV PR number to copy from (optional - auto-detected from GitHub if not provided)
- `-q, --qa [branch]`: QA base branch name. Use flag only to use saved config, or provide branch name explicitly.
- `-u, --uat [branch]`: UAT base branch name. Use flag only to use saved config, or provide branch name explicitly.
- `--pre-prod [branch]`: PRE-PROD base branch name. Use flag only to use saved config, or provide branch name explicitly.
- `-p, --prod [branch]`: PROD base branch name. Use flag only to use saved config, or provide branch name explicitly.
- `-t, --token <token>`: GitHub personal access token (optional, uses saved token or GITHUB_TOKEN env var if not provided)
- `-V, --version`: Display version
- `-h, --help`: Display help

**Note**: 
- Must provide at least one environment
- `--dev-pr` is optional - the tool will search GitHub for PRs associated with your current branch
- Requires GitHub personal access token with `repo` scope (use `cggit setup` to configure)
- The PR body will include the original DEV PR description followed by "DEV PR: #<number>"
- Branches are automatically pushed to remote before creating PRs

#### GitHub Token Setup

You need a GitHub personal access token to create PRs. The easiest way is to use the interactive setup:

```bash
setup-token
```

The token can be provided in three ways (in order of precedence):

1. **Saved file** (recommended - set by `setup-token`):
```bash
# Token is automatically loaded from ~/.create-hotfix/github-token
create-pr --dev-pr 123 --qa qa-release-1.0
```

2. **Environment variable**:
```bash
export GITHUB_TOKEN=ghp_your_token_here
create-pr --dev-pr 123 --qa qa-release-1.0
```

3. **Command line option**:
```bash
create-pr --dev-pr 123 --qa qa-release-1.0 --token ghp_your_token_here
```

**Manual token creation:**
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "Hotfix Branch Creator")
4. Select `repo` scope (Full control of private repositories)
5. Click "Generate token" and copy it immediately

## How it works

1. **Environment check**
   - Verify you're not on dev branch
   - Check that required branches exist (dev, qa-branch, uat-branch)

2. **Get commits**
   - Fetch latest changes from remote
   - Get list of commits between `origin/dev` and current feature branch
   - Display list of commits to be cherry-picked

3. **Create hotfix branches**
   - Create `<feature-branch>-for-qa` from QA base branch
   - Create `<feature-branch>-for-uat` from UAT base branch
   - Cherry-pick each commit into the hotfix branches

4. **Handle conflicts**
   - Auto-resolve version conflicts in package.json
   - Require manual resolution for other conflicts

5. **Restore versions**
   - Automatically restore package.json versions to base branch versions
   - Ensure no version changes when merging hotfix

6. **Push (optional)**
   - Ask for confirmation before pushing
   - Push hotfix branches to remote

## Requirements

- Node.js >= 14.0.0
- Initialized Git repository
- Access to remote repository (if pushing)

## Recommended workflow

1. Checkout your feature branch
2. Ensure feature branch is fully committed
3. Run tool to create hotfix branches
4. Review created hotfix branches
5. Push to remote (or use `--no-push` to review first)
6. Create Pull Request from hotfix branches to QA/UAT branches

## Complete Workflow Example

Here's a complete workflow from setup to creating PRs:

```bash
# Step 0: First-time setup (only needed once)
cggit setup
# Select "Authorize via browser"
# Enter the code shown in GitHub
# Token is automatically saved!

# Step 1: Configure default branches (only needed once)
cggit config
# Enter: qa-release-2.0, uat-release-2.0, pre-prod-release-2.0, prod-release-2.0
# Configuration is saved!

# Step 2: Create hotfix branches (using saved config)
cggit hotfix -q -u --pre-prod -p
# Creates branches for all environments!

# Step 3: Review and push (if not auto-pushed)
git push origin feature/new-login-page-for-qa -f --no-verify
git push origin feature/new-login-page-for-uat -f --no-verify
git push origin feature/new-login-page-for-pre-prod -f --no-verify
git push origin feature/new-login-page-for-prod -f --no-verify

# Step 4: Create PRs (using saved config, PR number auto-detected)
cggit pr -q -u --pre-prod -p
# Searches GitHub for PR associated with current branch
# Token is automatically loaded from saved file
# Branches are automatically pushed to remote
# Creates PRs for all environments!

# Done! PRs are created with DEV PR description and reference
```

### Even Simpler Workflow (After Initial Setup)

```bash
# After running 'cggit setup' and 'cggit config' once:

# Create hotfix branches
cggit hotfix -q -u --pre-prod -p

# Create PRs
cggit pr -q -u --pre-prod -p

# That's it! Just 2 commands! 🚀
```

## Detailed examples

### Scenario 1: Create hotfix for QA only

```bash
# You're on feature/new-login-page
git status
# On branch feature/new-login-page

# Create hotfix branch for QA only
create-hotfix --qa qa-release-2.0

# Tool will create:
# - feature/new-login-page-for-qa (from qa-release-2.0)
```

### Scenario 2: Create hotfix for both QA and UAT

```bash
# Create hotfix branches for both
create-hotfix --qa qa-release-2.0 --uat uat-release-2.0

# Tool will create:
# - feature/new-login-page-for-qa (from qa-release-2.0)
# - feature/new-login-page-for-uat (from uat-release-2.0)
```

### Scenario 3: Review before pushing

```bash
# Create branches but don't push
create-hotfix --qa qa-release-2.0 --uat uat-release-2.0 --no-push

# Review created branches
git log feature/new-login-page-for-qa
git log feature/new-login-page-for-uat

# If OK, push manually
git push origin feature/new-login-page-for-qa -f
git push origin feature/new-login-page-for-uat -f
```

### Scenario 4: Create PRs after hotfix branches

```bash
# After creating and pushing hotfix branches
# Auto-detect PR number from GitHub
create-pr --qa qa-release-2.0 --uat uat-release-2.0

# The tool will:
# 1. Search GitHub for PR associated with current branch
# 2. Find PR #456 (open, closed, or merged)
# 3. Fetch DEV PR #456 details
# 4. Create PR: feature/new-login-page-for-qa → qa-release-2.0
# 5. Create PR: feature/new-login-page-for-uat → uat-release-2.0
# 6. Each PR body will include original description + "DEV PR: #456"

# Or explicitly specify DEV PR number (skip GitHub search)
create-pr --dev-pr 456 --qa qa-release-2.0 --uat uat-release-2.0
```

## Token Management

### Setup token for the first time

```bash
setup-token
```

The command provides an interactive menu:
- **🚀 Authorize via browser (Recommended)** - No copy/paste needed!
- **📝 Enter token manually** - If you already have a token
- **🌐 Open GitHub token page** - Create token manually
- **🔍 Check saved token** - See if you already have a token
- **❌ Exit**

#### Browser Authorization Flow:

```bash
setup-token
# Select: "Authorize via browser"

# The tool will:
# 1. Show you a code (e.g., ABCD-1234)
# 2. Open GitHub in your browser
# 3. You enter the code on GitHub
# 4. Click "Authorize"
# 5. Token is automatically saved!
```

### Verify your token

```bash
setup-token --verify
```

This checks if your token is valid and shows where it's loaded from (file or environment variable).

### Show saved token

```bash
setup-token --show
```

Displays your saved token (partially masked) and offers to show the full token.

### Clear saved token

```bash
setup-token --clear
```

Removes the saved token file from `~/.create-hotfix/github-token`.

## Error handling

### GitHub token not found

```
Error: GitHub token not found. Please run "setup-token" command first...
```

**Solution**: Run `setup-token` to set up your GitHub token interactively.

### Branch doesn't exist

```
Error: Branch 'qa-release-2.0' does not exist
```

**Solution**: Ensure branch name is correct and branch exists in repository.

### No commits to cherry-pick

```
Error: No commits found between dev and feature/your-branch
```

**Solution**: Your feature branch needs to have new commits compared to dev branch.

### Conflicts that can't be auto-resolved

```
Error: Cherry-pick has conflicts that require manual resolution
```

**Solution**: Tool will stop and guide you to resolve conflicts manually.

## Development

### Clone repository

```bash
git clone <repository-url>
cd create-hotfix-branches
```

### Install dependencies

```bash
npm install
```

### Link locally for testing

```bash
npm link
```

### Test tool

```bash
create-hotfix --qa qa-branch --uat uat-branch --no-push
```

## Bash Script Alternative

This package also includes a bash script version (`create-hotfix-branches.sh`) for creating hotfix branches without Node.js:

```bash
# QA only
./create-hotfix-branches.sh --qa qa-release-1.0

# UAT only
./create-hotfix-branches.sh --uat uat-release-1.0

# Both QA and UAT
./create-hotfix-branches.sh --qa qa-release-1.0 --uat uat-release-1.0

# With no-push option
./create-hotfix-branches.sh --qa qa-release-1.0 --no-push
```

**Note:** The bash script only handles hotfix branch creation. For PR creation, use the `cggit pr` command.

## License

MIT

## Author

Created from original bash script, converted to Node.js CLI tool.

## Contributing

Contributions, issues and feature requests are welcome!
