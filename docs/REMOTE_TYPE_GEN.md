# Remote Type Generation from Supabase

To generate types from your **hosted Supabase project** (without Docker):

```bash
# Option 1: Using project reference (from dashboard)
supabase gen types typescript --project-id YOUR_PROJECT_REF > src/lib/server/database.types.ts

# Option 2: Using linked project
supabase link --project-ref YOUR_PROJECT_REF
supabase gen types typescript --linked > src/lib/server/database.types.ts
```

**To find your project reference:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → General
4. Copy the "Reference ID" (looks like: `abcdefghijklmnop`)

Then run:
```bash
supabase gen types typescript --project-id ritpdjwomrvkfogqanlj > src/lib/server/database.types.ts
```

This will pull the schema from your production database and generate fresh types!
