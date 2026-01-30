# cggit - Examples & Use Cases

## 🚀 Quick Start (Recommended)

### First Time Setup

```bash
# 1. Setup GitHub token (one time only)
cggit setup
# Choose: "Authorize via browser"
# Enter code on GitHub
# ✓ Token saved!

# 2. Configure default branches (one time only)
# Option A: Interactive (all at once)
cggit config
# Enter your default branches:
#   QA: qa-release-1.0
#   UAT: uat-release-1.0
#   PRE-PROD: pre-prod-release-1.0
#   PROD: prod-release-1.0
# ✓ Configuration saved!

# Option B: One at a time (recommended if you prefer)
cggit config -q qa-release-1.0
cggit config -u uat-release-1.0
cggit config --pre-prod pre-prod-release-1.0
cggit config -p prod-release-1.0
# ✓ Each branch saved individually!
```

### Daily Usage (After Setup)

```bash
# Create hotfix branches for all environments
cggit hotfix -q -u --pre-prod -p

# Create PRs for all environments
cggit pr -q -u --pre-prod -p

# That's it! 🎉
```

---

## 📚 Common Use Cases

### Use Case 1: Hotfix for Single Environment

```bash
# Only QA
cggit hotfix -q

# Only UAT
cggit hotfix -u

# Only PRE-PROD
cggit hotfix --pre-prod

# Only PROD
cggit hotfix -p
```

### Use Case 2: Hotfix for Multiple Environments

```bash
# QA and UAT only
cggit hotfix -q -u

# UAT, PRE-PROD, and PROD
cggit hotfix -u --pre-prod -p

# All environments
cggit hotfix -q -u --pre-prod -p
```

### Use Case 3: Override Saved Config

```bash
# Use saved config for QA, UAT, PROD but override PRE-PROD
cggit hotfix -q -u --pre-prod pre-prod-release-2.0 -p

# Override all branches
cggit hotfix -q qa-release-2.0 -u uat-release-2.0 --pre-prod pre-prod-release-2.0 -p prod-release-2.0
```

### Use Case 4: Create Branches Without Pushing

```bash
# Create branches locally for review
cggit hotfix -q -u --pre-prod -p --no-push

# Review the branches
git log feature/my-branch-for-qa
git log feature/my-branch-for-uat
git log feature/my-branch-for-pre-prod
git log feature/my-branch-for-prod

# Push manually when ready
git push origin feature/my-branch-for-qa -f --no-verify
git push origin feature/my-branch-for-uat -f --no-verify
git push origin feature/my-branch-for-pre-prod -f --no-verify
git push origin feature/my-branch-for-prod -f --no-verify
```

### Use Case 5: Create PRs with Auto-Detection

```bash
# Auto-detect DEV PR number from GitHub
cggit pr -q -u --pre-prod -p

# The tool will:
# 1. Search GitHub for PR associated with current branch
# 2. Find the PR (open, closed, or merged)
# 3. Copy PR title and description
# 4. Push hotfix branches to remote
# 5. Create PRs for all specified environments
```

### Use Case 6: Create PRs with Explicit PR Number

```bash
# Specify DEV PR number (skip auto-detection)
cggit pr --dev-pr 456 -q -u --pre-prod -p

# Useful when:
# - You know the PR number
# - Auto-detection might find wrong PR
# - You want to copy from a different PR
```

### Use Case 7: Incremental Configuration (Set One Branch at a Time)

```bash
# Day 1: Only have QA branch ready
cggit config -q qa-release-1.0
cggit hotfix -q
cggit pr -q

# Day 2: UAT branch is ready
cggit config -u uat-release-1.0
cggit hotfix -q -u
cggit pr -q -u

# Day 3: PRE-PROD branch is ready
cggit config --pre-prod pre-prod-release-1.0
cggit hotfix -q -u --pre-prod
cggit pr -q -u --pre-prod

# Day 4: PROD branch is ready
cggit config -p prod-release-1.0
cggit hotfix -q -u --pre-prod -p
cggit pr -q -u --pre-prod -p

# No need to configure all at once!
```

### Use Case 8: Different Branches for Different Projects

```bash
# Project A uses release-1.0
cggit config -q qa-release-1.0 -u uat-release-1.0 --pre-prod pre-prod-release-1.0 -p prod-release-1.0

# Later, switch to Project B (release-2.0)
# Quick update - just change all branches at once
cggit config -q qa-release-2.0 -u uat-release-2.0 --pre-prod pre-prod-release-2.0 -p prod-release-2.0

# Or update one by one
cggit config -q qa-release-2.0
cggit config -u uat-release-2.0
# ... etc

# Or use explicit branches without changing config
cggit hotfix -q qa-release-2.0 -u uat-release-2.0
```

---

## 🔧 Configuration Management

### View Current Configuration

```bash
cggit config --show
```

Output:
```
Current Branch Configuration:
──────────────────────────────────────────────────
  QA         : qa-release-1.0
  UAT        : uat-release-1.0
  PRE-PROD   : pre-prod-release-1.0
  PROD       : prod-release-1.0
```

### Set Individual Branches (Recommended)

```bash
# Set one branch at a time
cggit config -q qa-release-1.0
cggit config -u uat-release-1.0
cggit config --pre-prod pre-prod-release-1.0
cggit config -p prod-release-1.0

# Set multiple branches at once
cggit config -q qa-release-1.0 -u uat-release-1.0

# Update only QA branch (keeps other branches unchanged)
cggit config -q qa-release-2.0
```

### Update All Branches (Interactive)

```bash
# Run config again to update all branches interactively
cggit config

# Only update specific branches (leave others empty to keep existing)
cggit config
# QA: [press Enter to keep current]
# UAT: uat-release-2.0 [update this one]
# PRE-PROD: [press Enter to keep current]
# PROD: [press Enter to keep current]
```

### Clear Configuration

```bash
cggit config --clear
```

---

## 🎯 Real-World Scenarios

### Scenario 1: Emergency Hotfix to Production

```bash
# You're on feature/fix-critical-bug
# Need to deploy to PROD immediately

# 1. Create hotfix branch for PROD only
cggit hotfix -p

# 2. Create PR for PROD
cggit pr -p

# 3. Get PR approved and merge
# 4. Deploy to production
```

### Scenario 2: Progressive Rollout (QA → UAT → PRE-PROD → PROD)

```bash
# Week 1: Deploy to QA
cggit hotfix -q
cggit pr -q

# Week 2: After QA testing, deploy to UAT
cggit hotfix -u
cggit pr -u

# Week 3: After UAT testing, deploy to PRE-PROD
cggit hotfix --pre-prod
cggit pr --pre-prod

# Week 4: After PRE-PROD testing, deploy to PROD
cggit hotfix -p
cggit pr -p
```

### Scenario 3: Simultaneous Deployment to All Environments

```bash
# Deploy to all environments at once
cggit hotfix -q -u --pre-prod -p
cggit pr -q -u --pre-prod -p

# All PRs created!
# Merge them as needed
```

### Scenario 4: Multiple Features in Different Branches

```bash
# Feature A (on branch feature/login)
git checkout feature/login
cggit hotfix -q -u
cggit pr -q -u

# Feature B (on branch feature/payment)
git checkout feature/payment
cggit hotfix -q -u
cggit pr -q -u

# Each feature gets its own hotfix branches and PRs
# - feature/login-for-qa → qa-release-1.0
# - feature/login-for-uat → uat-release-1.0
# - feature/payment-for-qa → qa-release-1.0
# - feature/payment-for-uat → uat-release-1.0
```

---

## 💡 Tips & Tricks

### Tip 1: Use Aliases for Even Faster Workflow

Add to your `.bashrc` or `.zshrc`:

```bash
alias hf='cggit hotfix -q -u --pre-prod -p'
alias pr='cggit pr -q -u --pre-prod -p'
```

Then just:
```bash
hf  # Create hotfix branches
pr  # Create PRs
```

### Tip 2: Check Configuration Before Running

```bash
# Always good to verify your config
cggit config --show

# Then run hotfix/pr commands
cggit hotfix -q -u --pre-prod -p
```

### Tip 3: Mix and Match Environments

```bash
# Only QA and PROD (skip UAT and PRE-PROD)
cggit hotfix -q -p
cggit pr -q -p

# Only UAT and PRE-PROD
cggit hotfix -u --pre-prod
cggit pr -u --pre-prod
```

### Tip 4: Verify Token Before Important Operations

```bash
# Check if token is valid
cggit setup --verify

# Then proceed with PR creation
cggit pr -q -u --pre-prod -p
```

---

## 🐛 Troubleshooting

### Problem: "Must provide at least one environment"

**Solution**: You need to specify at least one environment flag

```bash
# ❌ Wrong
cggit hotfix

# ✓ Correct
cggit hotfix -q
```

### Problem: "Branch 'qa-release-1.0' does not exist"

**Solution**: Make sure the branch exists in your repository

```bash
# Check if branch exists
git branch -a | grep qa-release-1.0

# If not, update your config
cggit config
```

### Problem: "GitHub token not found"

**Solution**: Run setup command

```bash
cggit setup
```

### Problem: "Validation Failed: field: head, code: invalid"

**Solution**: The hotfix branch doesn't exist on remote. The tool now automatically pushes branches before creating PRs, but if you see this error:

```bash
# Push the branch manually
git push origin feature/my-branch-for-qa --no-verify

# Then try creating PR again
cggit pr -q
```

---

## 📖 Command Reference

### All Commands

```bash
cggit setup                    # Setup GitHub token
cggit setup --verify           # Verify token
cggit setup --show             # Show saved token
cggit setup --clear            # Clear token

cggit config                   # Configure branches
cggit config --show            # Show configuration
cggit config --clear           # Clear configuration

cggit hotfix [options]         # Create hotfix branches
cggit pr [options]             # Create pull requests
cggit release [options]        # Create GitHub release
cggit helm [options]           # Update helm chart
```

### Hotfix Options

```bash
-q, --qa [branch]              # QA environment
-u, --uat [branch]             # UAT environment
--pre-prod [branch]            # PRE-PROD environment
-p, --prod [branch]            # PROD environment
-n, --no-push                  # Don't push to remote
```

### PR Options

```bash
-d, --dev-pr <number>          # DEV PR number (optional)
-q, --qa [branch]              # QA environment
-u, --uat [branch]             # UAT environment
--pre-prod [branch]            # PRE-PROD environment
-p, --prod [branch]            # PROD environment
-t, --token <token>            # GitHub token (optional)
```

---

## 🎉 Success Stories

### Before cggit

```bash
# Create QA hotfix branch
git checkout qa-release-1.0
git pull origin qa-release-1.0
git checkout -b feature/my-feature-for-qa
git cherry-pick <commit1>
git cherry-pick <commit2>
git cherry-pick <commit3>
# ... handle conflicts ...
git push origin feature/my-feature-for-qa -f

# Create UAT hotfix branch
git checkout uat-release-1.0
git pull origin uat-release-1.0
git checkout -b feature/my-feature-for-uat
git cherry-pick <commit1>
git cherry-pick <commit2>
git cherry-pick <commit3>
# ... handle conflicts ...
git push origin feature/my-feature-for-uat -f

# Create PRs manually on GitHub...
# Copy/paste PR description...
# Repeat for PRE-PROD and PROD...

# Total time: ~30 minutes 😫
```

### After cggit

```bash
# One-time setup (first time only)
cggit setup
cggit config

# Daily usage
cggit hotfix -q -u --pre-prod -p
cggit pr -q -u --pre-prod -p

# Total time: ~2 minutes 🚀
```

**Time saved: 28 minutes per hotfix!**

---

## 🙏 Feedback

If you have questions or suggestions, please create an issue on GitHub!

