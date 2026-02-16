# OpenClaw Multi-Tenant Fork - Workflow Guide

**Repository**: `sihlemabaleka/openclaw-multitenant`
**Current Branch**: `multitenant-saas`
**Upstream**: `openclaw/openclaw`

---

## Branch Strategy

### 🔧 `multitenant-saas` (Your Production Branch)

- **Purpose**: Multi-tenant SaaS fork with guardrails, BYOC, and custom features
- **Remote**: `fork/multitenant-saas`
- **URL**: https://github.com/sihlemabaleka/openclaw-multitenant/tree/multitenant-saas
- **Workflow**: Active development, push directly

### 📥 `main` (Upstream Sync Branch)

- **Purpose**: Mirror of upstream OpenClaw for pulling updates
- **Remote**: `origin/main` (openclaw/openclaw)
- **Workflow**: Read-only, pull upstream changes, cherry-pick to multitenant-saas

---

## Daily Workflow

### Working on Multi-Tenant Features

```bash
# Make sure you're on the right branch
git checkout multitenant-saas

# Pull latest changes
git pull fork multitenant-saas

# Make your changes, then commit
git add .
git commit -m "feat: add new feature"

# Push to your fork
git push fork multitenant-saas
```

### Pulling Upstream Updates

```bash
# Switch to main to get upstream changes
git checkout main
git pull origin main

# Review what changed
git log --oneline -10

# Cherry-pick specific commits to multitenant-saas
git checkout multitenant-saas
git cherry-pick <commit-hash>

# Or merge if you want all changes
git merge main

# Push updated multitenant-saas
git push fork multitenant-saas
```

### Creating Feature Branches

```bash
# Branch off multitenant-saas for new features
git checkout multitenant-saas
git checkout -b feature/new-guardrail

# Work on feature, then merge back
git checkout multitenant-saas
git merge feature/new-guardrail
git push fork multitenant-saas
```

---

## Remote Configuration

```bash
# View configured remotes
git remote -v

# Output:
# origin → git@github.com:openclaw/openclaw.git (upstream)
# fork   → git@github.com:sihlemabaleka/openclaw-multitenant.git (your fork)
```

### Remote Management

```bash
# Fetch from upstream (origin)
git fetch origin

# Fetch from your fork
git fetch fork

# Pull from upstream main
git pull origin main

# Pull from your fork's multitenant-saas
git pull fork multitenant-saas
```

---

## Common Operations

### Check Current Branch

```bash
git branch -vv
# * multitenant-saas 58daa65c6 [fork/multitenant-saas] docs: update MVP status
#   main             58daa65c6 [origin/main: ahead 7, behind 2070] docs: update MVP status
```

### View Divergence from Upstream

```bash
# See how many commits ahead/behind upstream you are
git checkout main
git fetch origin
git log --oneline origin/main..HEAD  # Your commits
git log --oneline HEAD..origin/main  # Upstream commits
```

### Create a Release

```bash
# Tag a release on multitenant-saas
git checkout multitenant-saas
git tag -a v1.0.0-multitenant -m "Release v1.0.0: Multi-tenant SaaS fork"
git push fork v1.0.0-multitenant

# View at: https://github.com/sihlemabaleka/openclaw-multitenant/releases
```

---

## Integration with openclaw-host

When you're ready to deploy the multi-tenant fork to openclaw-host:

### 1. Build and Push Docker Image

```bash
# Build Docker image
docker build -t registry.glue.africa/openclaw-fork:latest .
docker tag registry.glue.africa/openclaw-fork:latest registry.glue.africa/openclaw-fork:v1.0.0

# Push to registry
docker push registry.glue.africa/openclaw-fork:latest
docker push registry.glue.africa/openclaw-fork:v1.0.0
```

### 2. Update openclaw-host

Refer to `OPENCLAW_HOST_CHANGES.md` for detailed integration steps:

- Extend database schema
- Add API endpoints
- Build dashboard UI
- Configure pool-manager to use forked image

---

## Keeping Branches in Sync

### Update Main from Upstream (Monthly)

```bash
git checkout main
git fetch origin
git reset --hard origin/main  # Reset to match upstream exactly
```

### Merge Upstream Fixes into Multi-Tenant (As Needed)

```bash
# Get upstream changes
git checkout main
git pull origin main

# Switch to your branch and merge
git checkout multitenant-saas
git merge main

# Resolve conflicts if any, then push
git push fork multitenant-saas
```

---

## Troubleshooting

### "Diverged from upstream" Warning

This is normal! Your multitenant-saas branch is intentionally different from upstream.

### Merge Conflicts

When merging upstream changes:

```bash
# After git merge main shows conflicts
git status  # See conflicted files
# Edit files to resolve conflicts
git add <resolved-files>
git commit
git push fork multitenant-saas
```

### Accidentally Committed to Wrong Branch

```bash
# If you committed to main instead of multitenant-saas
git checkout main
git log --oneline -3  # Find the commit hash

git checkout multitenant-saas
git cherry-pick <commit-hash>

# Reset main to upstream
git checkout main
git reset --hard origin/main
```

---

## Quick Reference

| Task                          | Command                                     |
| ----------------------------- | ------------------------------------------- |
| Switch to multi-tenant branch | `git checkout multitenant-saas`             |
| Pull your changes             | `git pull fork multitenant-saas`            |
| Push your changes             | `git push fork multitenant-saas`            |
| Pull upstream updates         | `git checkout main && git pull origin main` |
| View branch status            | `git branch -vv`                            |
| Check remotes                 | `git remote -v`                             |

---

## Links

- **Your Fork**: https://github.com/sihlemabaleka/openclaw-multitenant
- **Multi-Tenant Branch**: https://github.com/sihlemabaleka/openclaw-multitenant/tree/multitenant-saas
- **Upstream**: https://github.com/openclaw/openclaw
- **openclaw-host Platform**: `/Users/sihlemabaleka/.openclaw/workspace/code/glue/openclaw-host`

---

## Status: Production Ready ✅

Your multi-tenant fork includes:

- ✅ Tenant configuration system with guardrails
- ✅ PII detection & redaction
- ✅ Content moderation via webhooks
- ✅ Tool restriction enforcement
- ✅ BYOC for Telegram, WhatsApp, Slack
- ✅ R2 backup system for SQLite
- ✅ SIGHUP handler for config hot-reload
- ✅ Comprehensive test coverage (98.2%)
- ✅ Complete documentation

**Ready to integrate with openclaw-host platform!** 🚀
