# Company Portal - Post Install

## Required Steps
1. Rebuild the frontend: `npm run build`
2. Deploy functions: `npm run deploy:functions`

## Required Scopes
This app requires the following scopes:
- admin.automations
- admin.audit

Configure these in Admin → Principal Scopes before enabling the app.

## Optional Configuration
- Set `COMPANY_PORTAL_AI_ENABLED=true` in your env for AI support features
- Set `COMPANY_PORTAL_GMAIL_ENABLED=true` in your env for Gmail integration
- Set `COMPANY_PORTAL_ANALYTICS_ENABLED=true` in your env for advanced analytics

## Database
No migrations required. Uses core Spine tables.

## Enable in Admin
Go to Admin → Marketplace → Company Portal → Enable

## Features
- Support Queue Management
- Knowledge Base Administration
- Community Moderation Tools
- Analytics Dashboard
- User Management
- AI Support Integration
- Knowledge Base Improvement Tools
- Gmail Extension Support

## Support
Documentation: https://docs.spine.dev/company-portal
Support: https://support.spine.dev
