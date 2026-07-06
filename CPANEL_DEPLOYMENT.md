# cPanel Deployment Guide - MUSEMBI PMS

## Pre-Deployment Checklist

- [x] Build completed successfully
- [x] dist/ folder created with all assets
- [x] .htaccess configured for SPA routing
- [x] manifest.webmanifest for PWA support
- [ ] Database migration completed on production
- [ ] Environment variables configured

## What's Included in dist/

```
dist/
├── index.html              (Main entry point)
├── .htaccess               (URL rewriting for SPA)
├── manifest.webmanifest    (PWA manifest)
├── _redirects              (Redirects configuration)
├── apple-touch-icon.png    (iOS app icon)
├── favicon.png             (Browser favicon)
├── icon-192.png            (PWA icon 192x192)
├── icon-512.png            (PWA icon 512x512)
└── assets/                 (JS, CSS, images - hashed for cache busting)
    ├── *.js                (JavaScript bundles)
    ├── *.css               (Stylesheets)
    └── *.png               (Images)
```

## cPanel Upload Steps

### Step 1: Upload Files

1. **SSH into your cPanel server:**
   ```bash
   ssh username@your-domain.com
   ```

2. **Navigate to public_html:**
   ```bash
   cd ~/public_html
   ```

3. **Upload dist folder contents:**
   - Using FTP: Upload all files from `dist/` to `public_html/`
   - Using cPanel File Manager: Upload as ZIP and extract
   - Using SCP: `scp -r dist/* username@your-domain.com:~/public_html/`

### Step 2: Configure .htaccess

The `.htaccess` file is included in the build. It enables:
- URL rewriting for React Router
- GZIP compression
- Browser caching
- Security headers

Verify it's in place:
```bash
ls -la ~/public_html/.htaccess
```

If missing, create it with:
```bash
cat > ~/public_html/.htaccess << 'HTACCESS'
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  
  # Skip actual files and directories
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  
  # Route all requests to index.html for SPA
  RewriteRule ^ index.html [QSA,L]
</IfModule>

<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript
</IfModule>

<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/html "access plus 1 hour"
  ExpiresByType text/css "access plus 1 month"
  ExpiresByType application/javascript "access plus 1 month"
  ExpiresByType image/png "access plus 1 month"
  ExpiresByType image/jpeg "access plus 1 month"
</IfModule>
HTACCESS
```

### Step 3: Verify Installation

1. **Check file permissions:**
   ```bash
   chmod 755 ~/public_html
   chmod 644 ~/public_html/*.html
   chmod 644 ~/public_html/*.json
   chmod 644 ~/public_html/.htaccess
   chmod 755 ~/public_html/assets
   chmod 644 ~/public_html/assets/*
   ```

2. **Test the app:**
   - Open https://your-domain.com in browser
   - Check console for errors (F12 → Console)
   - Test navigation (click links)

3. **Verify HTTPS:**
   - Should redirect to https automatically
   - Check SSL certificate is valid

### Step 4: Configure Environment

1. **Check environment variables:**
   - App uses Supabase URLs from public environment variables
   - No backend .env needed (frontend only)
   - API calls go to Supabase directly

2. **If using custom domain:**
   - Update any hardcoded URLs in code
   - Rebuild if URLs changed
   - Re-upload dist/

## Database Migration on Production

Before going live, complete the database migration:

1. **Go to Supabase Dashboard**
2. **SQL Editor → Paste migration SQL**
3. **Copy from:** `supabase/migrations/20260705_update_schema.sql`
4. **Run the migration**
5. **Verify tables and enums created**

## Troubleshooting

### White page on load
- Check browser console for errors (F12 → Console tab)
- Verify .htaccess is present
- Check dist/index.html exists
- Clear browser cache (Ctrl+Shift+Del)

### 404 on navigation
- .htaccess not working
- Check `RewriteEngine On` is enabled in .htaccess
- Verify mod_rewrite is enabled on server
  ```bash
  apache2ctl -M | grep rewrite
  ```

### Styles not loading
- Check dist/assets/ folder has CSS files
- Verify file permissions (644 for files, 755 for directories)
- Check browser console for 404s on CSS files

### Environment connection issues
- Verify Supabase project URL is correct
- Check API key permissions
- Ensure RLS policies allow access
- Check browser console for network errors

### PWA not installing
- Ensure HTTPS is enabled (required for PWA)
- Check manifest.webmanifest is accessible
- Verify service worker (if applicable)
- Try in Chrome/Edge first (best PWA support)

## Performance Tips

1. **Enable cPanel CDN** (if available)
   - Accelerate content delivery
   - Reduce load times

2. **Enable Gzip compression**
   - Already configured in .htaccess
   - Reduces file sizes by 60-80%

3. **Monitor bandwidth usage**
   - Assets are hashed for permanent caching
   - Users only download on first visit or after update

4. **Set up SSL/TLS**
   - Required for PWA
   - Use cPanel AutoSSL (usually enabled)

## Monitoring

### Check error logs:
```bash
tail -f ~/public_html/../logs/error_log
```

### Check access logs:
```bash
tail -f ~/public_html/../logs/access_log
```

### Monitor traffic:
- cPanel → Metrics → View traffic

### Test application:
- Open https://your-domain.com/dashboard
- Try creating a unit
- Try creating a lease
- Check maintenance page loads

## Rollback Plan

If issues occur:

1. **Quick rollback:**
   - Keep previous build in separate folder
   - FTP upload previous dist/ contents
   - Takes ~2 minutes

2. **Full rollback:**
   - Restore database from backup
   - Deploy previous frontend build
   - Create incident report

## Maintenance

### Deploying updates:

1. Build locally: `npm run build`
2. Test locally
3. Upload new dist/ files via FTP
4. Clear browser cache
5. Test on production

### Database updates:

1. Create new migration
2. Test on staging database
3. Run on production database
4. Deploy frontend if needed

### Monitoring updates:

1. Check error logs after deployment
2. Monitor API calls for errors
3. Check response times
4. Verify no broken features

## Support Files

All documentation is included:
- `README_UPDATES.md` - Feature overview
- `QUICK_REFERENCE.md` - Developer guide
- `DEPLOYMENT_STEPS.md` - Detailed deployment
- `COMPLETION_CHECKLIST.md` - Testing guide
- `INSTALL_BANNER.md` - PWA installation

## Deployment Checklist

Before going live:
- [ ] Build completed: `npm run build`
- [ ] dist/ folder created
- [ ] Files uploaded to public_html
- [ ] .htaccess configured
- [ ] Permissions set correctly (755/644)
- [ ] HTTPS working
- [ ] Database migration completed
- [ ] Test app loads on production domain
- [ ] Test navigation works
- [ ] Console has no errors
- [ ] Test on mobile (PWA banner shows)
- [ ] Test maintenance page (staff only)
- [ ] Test unit creation (dropdowns work)
- [ ] Test tenant creation (no KRA PIN field)

## Live URL

Your app will be available at:
- https://your-domain.com
- All routes work: /dashboard, /units, /tenants, /leases, /maintenance, etc.

## Questions?

Refer to:
1. Console logs (F12 → Console)
2. Network tab (F12 → Network) for API errors
3. QUICK_REFERENCE.md for architecture
4. README_UPDATES.md for features

---

**Status:** ✅ Ready for cPanel deployment
**Build Date:** 2026-07-05
**Version:** 1.0 Production
