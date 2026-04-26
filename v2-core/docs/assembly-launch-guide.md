# Spine v2 Assembly & Launch Process Guide

## Architecture Overview

**Directory Structure:**
- `/v2-core/functions` + `/v2-custom/functions` → `/functions` (Netlify functions)
- `/v2-core/src` + `/v2-custom/src` → `/src/v2-assembled` (Vite frontend)
- `/v2-core/index.html` → `/src/v2-assembled/index.html` (with path fixes)

**Assembly Chain:**
1. `netlify dev` → `scripts/netlify-dev-wrapper.sh`
2. Wrapper → `npm run assemble:v2` (61 frontend + 43 functions)
3. Wrapper → `exec node_modules/.bin/vite` (direct binary, NOT npm/npx)
4. Netlify loads functions and proxies port 8888 → 3001

**NEVER edit `src/v2-assembled/` or `functions/`** — overwritten on assembly.

## Process Management Commands

### Check Running Ports
```bash
# Check Vite (port 3001)
lsof -i:3001

# Check Netlify (port 8888)  
lsof -i:8888

# Check both at once
lsof -i:3001 && lsof -i:8888
```

### Kill Servers
```bash
# Kill both frontend and backend
pkill -f vite && pkill -f netlify

# Alternative: kill by port
lsof -ti:3001 | xargs kill -9  # Vite
lsof -ti:8888 | xargs kill -9  # Netlify
```

## Assembly Testing

### Test Frontend Assembly
```bash
# Test only frontend assembly
bash scripts/assemble-v2-frontend.sh

# Verify results
ls -la src/v2-assembled/
ls -la src/v2-assembled/components/
cat src/v2-assembled/index.html  # Check script path is "./main.tsx"
```

### Test Functions Assembly
```bash
# Test only functions assembly
bash scripts/assemble-v2-functions.sh

# Verify results
ls -la functions/
ls -la functions/_shared/
```

### Test Full Assembly
```bash
# Test complete assembly chain
bash scripts/assemble-v2.sh

# Should show:
# ✓ Core: 61 files (frontend)
# ✓ Core: index.html (paths fixed)
# ✓ Core: 3 public files
# ✓ Core: 43 files (functions)
```

## Launch Process

### Standard Launch (Recommended)
```bash
# Single command - does everything
netlify dev
```

**What happens automatically:**
1. Runs `assemble:v2` (frontend + functions)
2. Starts Vite on port 3001
3. Starts Netlify proxy on port 8888
4. Loads all 43 functions

### Manual Launch (Debug Mode)
```bash
# Step 1: Assemble
bash scripts/assemble-v2.sh

# Step 2: Start Vite directly (in terminal 1)
# IMPORTANT: Use the binary directly — npm run dev / npx vite hang under Netlify CLI
./node_modules/.bin/vite --config vite.config.ts

# Step 3: Start Netlify (in terminal 2)
netlify dev
```

## Troubleshooting Checklist

### If 404 Errors:
1. **Check index.html exists:** `ls src/v2-assembled/index.html`
2. **Check script path:** `cat src/v2-assembled/index.html` (should be `./main.tsx`)
3. **Check components exist:** `ls src/v2-assembled/components/ui/`
4. **Reassemble:** `bash scripts/assemble-v2-frontend.sh`

### If Functions Missing:
1. **Check functions directory:** `ls functions/`
2. **Check function count:** `ls functions/*.ts | wc -l` (should be 43)
3. **Reassemble functions:** `bash scripts/assemble-v2-functions.sh`

### If Port Conflicts:
1. **Check what's running:** `lsof -i:3001 && lsof -i:8888`
2. **Kill processes:** `pkill -f vite && pkill -f netlify`
3. **Restart:** `netlify dev`

## Known Issues

### npx/npm silently hang under Netlify CLI
**Symptom:** `netlify dev` times out waiting for port 3001. Vite never starts.
**Cause:** `npx vite` and `npm run dev` silently hang when spawned as a Netlify CLI child process — the process starts but never binds to the port and produces no output.
**Fix:** The wrapper (`scripts/netlify-dev-wrapper.sh`) uses `exec node_modules/.bin/vite` to invoke the binary directly.
**If you see this again:** verify the wrapper is NOT using `npm run dev` or `npx vite`.

## Key Files to Remember

**Assembly Scripts:**
- `scripts/assemble-v2.sh` - Main assembly orchestrator
- `scripts/assemble-v2-frontend.sh` - Frontend assembly (fixes index.html paths)
- `scripts/assemble-v2-functions.sh` - Functions assembly
- `scripts/netlify-dev-wrapper.sh` - Netlify dev entry point

**Configuration:**
- `netlify.toml` - Netlify config (points to `/functions`)
- `vite.config.ts` - Vite config (root: `src/v2-assembled`)
- `package.json` - Scripts and dependencies

## Quick Reference Commands

```bash
# 🚀 Launch
netlify dev

# 📊 Check status
lsof -i:3001 && lsof -i:8888

# 💀 Kill all
pkill -f vite && pkill -f netlify

# 🔧 Test assembly
bash scripts/assemble-v2.sh

# 🧪 Clean restart
pkill -f vite && pkill -f netlify && sleep 2 && netlify dev
```

**Remember:** `netlify dev` handles everything automatically - only use manual steps for debugging!
