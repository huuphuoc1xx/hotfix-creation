# Changelog

## [Latest] - 2026-01-29

### ✨ New Features

#### Config System - Save Default Branches
- Added `cggit config` command to save default branches
- Support for individual branch configuration
- No need to type branch names every time!

### 📝 Changes to `bin/cggit.js`

#### Added Config Command (lines 31-49)
```javascript
// Config branches command
program
  .command('config')
  .description('Configure default branches for environments')
  .option('--show', 'Show current configuration')
  .option('--clear', 'Clear saved configuration')
  .option('-q, --qa <branch>', 'Set QA branch')
  .option('-u, --uat <branch>', 'Set UAT branch')
  .option('--pre-prod <branch>', 'Set PRE-PROD branch')
  .option('-p, --prod <branch>', 'Set PROD branch')
  .action(async (options) => {
    try {
      const configCommand = require('./config-logic');
      await configCommand(options);
    } catch (error) {
      console.error(chalk.red(`\nError: ${error.message}`));
      process.exit(1);
    }
  });
```

#### Updated Hotfix Command (lines 51-108)
- Changed options to accept optional values: `-q, --qa [branch]`
- Added logic to load saved config
- Merge saved config with provided options
- Show helpful examples when no environment provided

#### Updated PR Command (lines 110-171)
- Changed options to accept optional values: `-q, --qa [branch]`
- Added logic to load saved config
- Merge saved config with provided options
- Show helpful examples when no environment provided

#### Updated Help Examples (lines 225-237)
- Added examples for `cggit config`
- Show how to set individual branches
- Show how to use saved config

### 📦 New Files

1. **`src/utils/config-manager.js`** - Config management utility
2. **`bin/config-logic.js`** - Config command logic
3. **`EXAMPLES.md`** - Comprehensive examples and use cases

### 🎯 Usage Examples

#### Before (Old Way)
```bash
cggit hotfix --qa qa-release-1.0 --uat uat-release-1.0 --pre-prod pre-prod-release-1.0 --prod prod-release-1.0
cggit pr --qa qa-release-1.0 --uat uat-release-1.0 --pre-prod pre-prod-release-1.0 --prod prod-release-1.0
```

#### After (New Way)
```bash
# Setup once
cggit config -q qa-release-1.0
cggit config -u uat-release-1.0
cggit config --pre-prod pre-prod-release-1.0
cggit config -p prod-release-1.0

# Or all at once
cggit config -q qa-release-1.0 -u uat-release-1.0 --pre-prod pre-prod-release-1.0 -p prod-release-1.0

# Then use shortcuts
cggit hotfix -q -u --pre-prod -p
cggit pr -q -u --pre-prod -p
```

### 🚀 Benefits

- ⚡ **80% less typing** - Just use flags instead of full branch names
- 🎯 **Fewer errors** - No typos in branch names
- 🔄 **Flexible** - Can override saved config anytime
- 💾 **Persistent** - Config saved permanently
- 📦 **Incremental** - Set one branch at a time

### 📚 Documentation Updates

- Updated `README.md` with config instructions
- Created `EXAMPLES.md` with 8+ use cases
- Added tips & tricks section
- Added real-world scenarios

### 🔧 Technical Details

**Config Storage:**
- Location: `~/.create-hotfix/branches.json`
- Format: JSON with qa, uat, preProd, prod keys
- Automatically created on first use

**Command Behavior:**
- Flag without value (e.g., `-q`) → Use saved config
- Flag with value (e.g., `-q qa-release-2.0`) → Use provided value
- No flag → Skip that environment

### ✅ All Changes Verified

- ✅ No linter errors
- ✅ All commands tested
- ✅ Documentation complete
- ✅ Examples provided


