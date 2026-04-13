# 🚀 Quick Release Guide

## Pre-release Checklist

- [ ] All tests pass (`npm test`)
- [ ] Linter passes (`npm run lint`)
- [ ] README.md is up to date
- [ ] CHANGELOG.md is updated
- [ ] package.json version is correct
- [ ] All dependencies are correct
- [ ] .npmignore excludes unnecessary files
- [ ] License file is present
- [ ] Documentation is complete

## Release Steps

### 1. Update Version

```bash
# Update version in package.json
npm version patch  # 1.0.0 -> 1.0.1
# or
npm version minor  # 1.0.0 -> 1.1.0
# or
npm version major  # 1.0.0 -> 2.0.0
```

### 2. Update CHANGELOG

Edit `CHANGELOG.md` and update the release date:

```markdown
## [1.0.1] - 2026-04-14
```

### 3. Commit Changes

```bash
git add .
git commit -m "chore: release v1.0.1"
```

### 4. Create Git Tag

```bash
git tag -a v1.0.1 -m "Release v1.0.1"
```

### 5. Push to GitHub

```bash
git push origin main
git push origin v1.0.1
```

### 6. Publish to npm

```bash
# Login to npm (first time only)
npm login

# Publish
npm publish --access public
```

### 7. Create GitHub Release

```bash
# Or use GitHub web interface
gh release create v1.0.1 \
  --title "Release v1.0.1" \
  --notes "See CHANGELOG.md for details" \
  --generate-notes
```

## Automated Release (Recommended)

The project includes GitHub Actions for automated releases:

1. Create a new release on GitHub
2. CI/CD will automatically:
   - Run tests on all platforms
   - Run security audit
   - Publish to npm
   - Create GitHub release with assets

## Verify Release

### Check npm Package

```bash
# Check published version
npm view static-analysis-mcp version

# Install and test
npm install -g static-analysis-mcp
static-analysis-mcp --help
```

### Check GitHub Release

```bash
# List releases
gh release list

# Download and test release asset
gh release download v1.0.1 --pattern '*.tgz'
```

## Rollback (If Needed)

```bash
# Unpublish from npm (within 24 hours)
npm unpublish static-analysis-mcp@1.0.1

# Delete tag
git tag -d v1.0.1
git push --delete origin v1.0.1

# Delete release
gh release delete v1.0.1
```

## Post-release

- [ ] Announce release on social media
- [ ] Update documentation if needed
- [ ] Notify users of breaking changes
- [ ] Monitor npm downloads
- [ ] Watch for issues

---

**Happy Releasing!** 🎉
