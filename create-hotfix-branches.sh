#!/bin/bash

# Script to create hotfix branches for QA and/or UAT
# Usage: ./create-hotfix-branches.sh [--qa <qa-branch>] [--uat <uat-branch>] [-n]
# Options:
#   --qa <branch>    QA branch name
#   --uat <branch>   UAT branch name
#   -n, --no-push    No push - create branches but don't push to remote

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
NO_PUSH=false
QA_BRANCH=""
UAT_BRANCH=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --qa)
            QA_BRANCH="$2"
            shift 2
            ;;
        --uat)
            UAT_BRANCH="$2"
            shift 2
            ;;
        -n|--no-push)
            NO_PUSH=true
            shift
            ;;
        *)
            echo -e "${RED}Error: Unknown option $1${NC}"
            echo "Usage: $0 [--qa <qa-branch>] [--uat <uat-branch>] [-n]"
            echo "Example: $0 --qa qa-release-1.0"
            echo "Example: $0 --uat uat-release-1.0"
            echo "Example: $0 --qa qa-release-1.0 --uat uat-release-1.0"
            echo "Options:"
            echo "  --qa <branch>    QA branch name"
            echo "  --uat <branch>   UAT branch name"
            echo "  -n, --no-push    Create branches but don't push to remote"
            exit 1
            ;;
    esac
done

# Check if at least one branch is provided
if [ -z "$QA_BRANCH" ] && [ -z "$UAT_BRANCH" ]; then
    echo -e "${RED}Error: Must provide at least --qa or --uat${NC}"
    echo "Usage: $0 [--qa <qa-branch>] [--uat <uat-branch>] [-n]"
    echo "Example: $0 --qa qa-release-1.0"
    echo "Example: $0 --uat uat-release-1.0"
    echo "Example: $0 --qa qa-release-1.0 --uat uat-release-1.0"
    exit 1
fi

# Get current branch name
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "${GREEN}Current branch: ${CURRENT_BRANCH}${NC}"

# Check if we're not on dev branch
if [ "$CURRENT_BRANCH" = "dev" ]; then
    echo -e "${RED}Error: You are currently on dev branch. Please switch to your feature branch first.${NC}"
    exit 1
fi

# Check if dev branch exists
if ! git rev-parse --verify dev >/dev/null 2>&1; then
    echo -e "${RED}Error: dev branch does not exist${NC}"
    exit 1
fi

# Check if QA branch exists (if provided)
if [ -n "$QA_BRANCH" ]; then
    if ! git rev-parse --verify "$QA_BRANCH" >/dev/null 2>&1; then
        echo -e "${RED}Error: QA branch '${QA_BRANCH}' does not exist${NC}"
        exit 1
    fi
fi

# Check if UAT branch exists (if provided)
if [ -n "$UAT_BRANCH" ]; then
    if ! git rev-parse --verify "$UAT_BRANCH" >/dev/null 2>&1; then
        echo -e "${RED}Error: UAT branch '${UAT_BRANCH}' does not exist${NC}"
        exit 1
    fi
fi

# Fetch latest changes
echo -e "${YELLOW}Fetching latest changes...${NC}"
git fetch origin

# Get list of commits between dev and current branch
echo -e "${YELLOW}Getting commits from ${CURRENT_BRANCH} that are not in dev...${NC}"
COMMITS=$(git log origin/dev..${CURRENT_BRANCH} --pretty=format:"%H" --reverse)

if [ -z "$COMMITS" ]; then
    echo -e "${RED}Error: No commits found between dev and ${CURRENT_BRANCH}${NC}"
    exit 1
fi

COMMIT_COUNT=$(echo "$COMMITS" | wc -l)
echo -e "${GREEN}Found ${COMMIT_COUNT} commit(s) to cherry-pick${NC}"

# Show commits
echo -e "${YELLOW}Commits to be cherry-picked:${NC}"
git log origin/dev..${CURRENT_BRANCH} --oneline

# Create hotfix branch names
HOTFIX_QA_BRANCH=""
HOTFIX_UAT_BRANCH=""

if [ -n "$QA_BRANCH" ]; then
    HOTFIX_QA_BRANCH="${CURRENT_BRANCH}-for-qa"
fi

if [ -n "$UAT_BRANCH" ]; then
    HOTFIX_UAT_BRANCH="${CURRENT_BRANCH}-for-uat"
fi

echo ""
echo -e "${YELLOW}Will create the following branches:${NC}"
if [ -n "$HOTFIX_QA_BRANCH" ]; then
    echo -e "  - ${GREEN}${HOTFIX_QA_BRANCH}${NC} (from ${QA_BRANCH})"
fi
if [ -n "$HOTFIX_UAT_BRANCH" ]; then
    echo -e "  - ${GREEN}${HOTFIX_UAT_BRANCH}${NC} (from ${UAT_BRANCH})"
fi
echo ""

# Ask for confirmation
read -p "Do you want to proceed? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Operation cancelled${NC}"
    exit 0
fi

# Function to create hotfix branch and cherry-pick commits
create_hotfix_branch() {
    local BASE_BRANCH=$1
    local HOTFIX_BRANCH=$2
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Creating hotfix branch: ${HOTFIX_BRANCH}${NC}"
    echo -e "${GREEN}========================================${NC}"
    
    # Check if hotfix branch already exists
    if git rev-parse --verify "$HOTFIX_BRANCH" >/dev/null 2>&1; then
        echo -e "${YELLOW}Warning: Branch ${HOTFIX_BRANCH} already exists${NC}"
        read -p "Do you want to delete and recreate it? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git branch -D "$HOTFIX_BRANCH"
            echo -e "${GREEN}Deleted existing branch${NC}"
        else
            echo -e "${YELLOW}Skipping ${HOTFIX_BRANCH}${NC}"
            return 1
        fi
    fi
    
    # Checkout base branch and update
    echo -e "${YELLOW}Checking out ${BASE_BRANCH}...${NC}"
    git checkout "$BASE_BRANCH"
    git pull origin "$BASE_BRANCH"
    
    # Create hotfix branch
    echo -e "${YELLOW}Creating branch ${HOTFIX_BRANCH}...${NC}"
    git checkout -b "$HOTFIX_BRANCH"
    
    # Cherry-pick commits
    echo -e "${YELLOW}Cherry-picking commits...${NC}"
    CHERRY_PICK_SUCCESS=true
    for COMMIT in $COMMITS; do
        COMMIT_MSG=$(git log -1 --pretty=format:"%s" $COMMIT)
        echo -e "${YELLOW}Cherry-picking: $(git log -1 --oneline $COMMIT)${NC}"
        
        # Cherry-pick without committing
        set +e  # Temporarily disable exit on error
        git cherry-pick --no-commit "$COMMIT" 2>&1
        CHERRY_PICK_EXIT_CODE=$?
        set -e  # Re-enable exit on error
        
        if [ $CHERRY_PICK_EXIT_CODE -ne 0 ]; then
            # Cherry-pick failed, likely due to conflicts
            echo -e "${YELLOW}Conflicts detected, attempting to resolve...${NC}"
            
            # Check if there are conflicts
            CONFLICTED_FILES=$(git diff --name-only --diff-filter=U 2>/dev/null || true)
            
            if [ -n "$CONFLICTED_FILES" ]; then
                HAS_UNRESOLVABLE_CONFLICT=false
                
                while IFS= read -r conflict_file; do
                    if [ -n "$conflict_file" ]; then
                        if [[ "$conflict_file" == *"package.json"* ]]; then
                            echo -e "${YELLOW}  - Checking conflict in ${conflict_file}...${NC}"
                            
                            # Read the conflicted file and analyze conflicts
                            VERSION_CONFLICT_ONLY=true
                            IN_CONFLICT=false
                            CONFLICT_HAS_VERSION=false
                            CONFLICT_HAS_OTHER=false
                            
                            while IFS= read -r line; do
                                if [[ "$line" == "<<<<<<< "* ]]; then
                                    IN_CONFLICT=true
                                    CONFLICT_HAS_VERSION=false
                                    CONFLICT_HAS_OTHER=false
                                elif [[ "$line" == ">>>>>>> "* ]]; then
                                    IN_CONFLICT=false
                                    # Check if this conflict block had non-version content
                                    if [ "$CONFLICT_HAS_OTHER" = true ]; then
                                        VERSION_CONFLICT_ONLY=false
                                        break
                                    fi
                                elif [ "$IN_CONFLICT" = true ] && [[ "$line" != "======="* ]] && [[ "$line" != "||||||| "* ]]; then
                                    # We're inside a conflict block, check the content
                                    if echo "$line" | grep -q '"version"'; then
                                        CONFLICT_HAS_VERSION=true
                                    elif echo "$line" | grep -qE '\S'; then
                                        # Non-empty line that's not a version line
                                        # Check if it's a meaningful change (not just whitespace or braces)
                                        TRIMMED=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
                                        if [ -n "$TRIMMED" ] && [[ "$TRIMMED" != "{" ]] && [[ "$TRIMMED" != "}" ]] && [[ "$TRIMMED" != "," ]]; then
                                            CONFLICT_HAS_OTHER=true
                                        fi
                                    fi
                                fi
                            done < "$conflict_file"
                            
                            if [ "$VERSION_CONFLICT_ONLY" = true ]; then
                                echo -e "${GREEN}    ✓ Conflict is version-only, auto-resolving (keeping base version)${NC}"
                                # For package.json with version-only conflict, keep the base branch version (ours)
                                git checkout --ours "$conflict_file"
                                git add "$conflict_file"
                            else
                                echo -e "${RED}    ✗ Conflict includes non-version changes, manual resolution required${NC}"
                                HAS_UNRESOLVABLE_CONFLICT=true
                            fi
                        else
                            echo -e "${RED}  - Conflict in ${conflict_file} requires manual resolution${NC}"
                            HAS_UNRESOLVABLE_CONFLICT=true
                        fi
                    fi
                done <<< "$CONFLICTED_FILES"
                
                # If there are unresolvable conflicts, stop and ask for manual resolution
                if [ "$HAS_UNRESOLVABLE_CONFLICT" = true ]; then
                    echo -e "${RED}Error: Cherry-pick has conflicts that require manual resolution${NC}"
                    echo -e "${YELLOW}Please resolve conflicts manually, then run:${NC}"
                    echo -e "  git add <resolved-files>"
                    echo -e "  git cherry-pick --continue"
                    echo -e "Or abort with:"
                    echo -e "  git cherry-pick --abort"
                    CHERRY_PICK_SUCCESS=false
                    return 1
                fi
                
                # Check if all conflicts are resolved
                REMAINING_CONFLICTS=$(git diff --name-only --diff-filter=U 2>/dev/null || true)
                if [ -n "$REMAINING_CONFLICTS" ]; then
                    echo -e "${RED}Error: Some conflicts could not be auto-resolved${NC}"
                    echo -e "${RED}Remaining conflicts in: ${REMAINING_CONFLICTS}${NC}"
                    CHERRY_PICK_SUCCESS=false
                    return 1
                fi
            else
                # No conflicts detected but cherry-pick failed
                echo -e "${RED}Error: Cherry-pick failed for unknown reason${NC}"
                CHERRY_PICK_SUCCESS=false
                return 1
            fi
        fi
        
        # At this point, all changes are staged. Now ensure package.json versions match base branch
        echo -e "${YELLOW}Ensuring package.json versions match base branch...${NC}"
        
        # Find all package.json files (both staged and unstaged)
        ALL_PACKAGE_FILES=$(git diff --name-only HEAD | grep 'package.json$' || true)
        
        if [ -n "$ALL_PACKAGE_FILES" ]; then
            while IFS= read -r pkg_file; do
                if [ -n "$pkg_file" ] && [ -f "$pkg_file" ]; then
                    echo -e "${YELLOW}  - Restoring original version in ${pkg_file}${NC}"
                    # Checkout the package.json from HEAD (base branch version)
                    git checkout HEAD -- "$pkg_file" 2>/dev/null || true
                fi
            done <<< "$ALL_PACKAGE_FILES"
        fi
        
        # Stage all remaining changes
        git add -A
        
        # Commit the changes (if there are any after resetting package.json)
        if ! git diff --cached --quiet; then
            git commit --no-verify -m "$COMMIT_MSG"
            echo -e "${GREEN}  ✓ Committed successfully${NC}"
        else
            echo -e "${YELLOW}  ⊘ Skipping commit - only package.json versions were changed${NC}"
        fi
    done
    
    if [ "$CHERRY_PICK_SUCCESS" = true ]; then
        echo -e "${GREEN}Successfully created ${HOTFIX_BRANCH} with all commits${NC}"
        echo -e "${YELLOW}To push this branch, run:${NC}"
        echo -e "  git push origin ${HOTFIX_BRANCH}"
    fi
    
    return 0
}

# Create hotfix branch for QA (if requested)
QA_RESULT=1
if [ -n "$HOTFIX_QA_BRANCH" ]; then
    create_hotfix_branch "$QA_BRANCH" "$HOTFIX_QA_BRANCH"
    QA_RESULT=$?
fi

# Create hotfix branch for UAT (if requested)
UAT_RESULT=1
if [ -n "$HOTFIX_UAT_BRANCH" ]; then
    create_hotfix_branch "$UAT_BRANCH" "$HOTFIX_UAT_BRANCH"
    UAT_RESULT=$?
fi

# Return to original branch
echo ""
echo -e "${YELLOW}Returning to original branch: ${CURRENT_BRANCH}${NC}"
git checkout "$CURRENT_BRANCH"

# Summary
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Summary${NC}"
echo -e "${GREEN}========================================${NC}"

BRANCHES_TO_PUSH=()

if [ -n "$HOTFIX_QA_BRANCH" ]; then
    if [ $QA_RESULT -eq 0 ]; then
        echo -e "${GREEN}✓ QA hotfix branch created: ${HOTFIX_QA_BRANCH}${NC}"
        BRANCHES_TO_PUSH+=("$HOTFIX_QA_BRANCH")
    else
        echo -e "${RED}✗ QA hotfix branch failed or skipped${NC}"
    fi
fi

if [ -n "$HOTFIX_UAT_BRANCH" ]; then
    if [ $UAT_RESULT -eq 0 ]; then
        echo -e "${GREEN}✓ UAT hotfix branch created: ${HOTFIX_UAT_BRANCH}${NC}"
        BRANCHES_TO_PUSH+=("$HOTFIX_UAT_BRANCH")
    else
        echo -e "${RED}✗ UAT hotfix branch failed or skipped${NC}"
    fi
fi

# Push branches if not in no-push mode
if [ "$NO_PUSH" = false ] && [ ${#BRANCHES_TO_PUSH[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}Push to Remote${NC}"
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}The following branches will be pushed:${NC}"
    for branch in "${BRANCHES_TO_PUSH[@]}"; do
        echo -e "  - ${GREEN}${branch}${NC}"
    done
    echo ""
    
    read -p "Do you want to push these branches to remote? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        for branch in "${BRANCHES_TO_PUSH[@]}"; do
            echo -e "${YELLOW}Pushing ${branch}...${NC}"
            if git push origin "$branch" -f --no-verify; then
                echo -e "${GREEN}✓ Successfully pushed ${branch}${NC}"
            else
                echo -e "${RED}✗ Failed to push ${branch}${NC}"
            fi
        done
    else
        echo -e "${YELLOW}Push cancelled. You can push manually later with:${NC}"
        for branch in "${BRANCHES_TO_PUSH[@]}"; do
            echo -e "  git push origin ${branch} -f --no-verify"
        done
    fi
elif [ "$NO_PUSH" = true ] && [ ${#BRANCHES_TO_PUSH[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}Branches created but not pushed (--no-push mode)${NC}"
    echo -e "${YELLOW}To push manually, run:${NC}"
    for branch in "${BRANCHES_TO_PUSH[@]}"; do
        echo -e "  git push origin ${branch} -f"
    done
fi

echo ""
echo -e "${GREEN}Done!${NC}"

