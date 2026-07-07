Run these grep checks and report any matches:

```bash
# Firebase Admin in client-accessible files
grep -rn "firebase-admin" src/ --include="*.tsx"

# Server secrets in public vars or client files
grep -rn "OPENAI_API_KEY\|FIREBASE_PRIVATE_KEY" src/app --include="*.ts" --include="*.tsx"

# eval / dynamic code execution
grep -rn "eval\b\|new Function\|dangerouslySetInnerHTML" src/

# Unawaited Firestore writes (floating promises)
grep -rn "\.\(set\|update\|add\|delete\)(" src/lib/intelligence src/app/api/intelligence --include="*.ts" | grep -v "await\|return\|//"

# Raw URL input without validation
grep -rn "req\.body\.url\|searchParams\.get.*url\|params\.url" src/app/api --include="*.ts"
```
