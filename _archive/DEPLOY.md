# כיצד לעדכן את StudyFlow ב-Netlify

## שיטה 1: Netlify CLI (מומלצת)
פתח PowerShell בתיקיית `C:\Users\andre\Downloads\StudyFlow` והרץ:

```powershell
# התקן Netlify CLI אם לא קיים
npm install -g netlify-cli

# התחבר לחשבון Netlify שלך
netlify login

# הגדר את הפרויקט
netlify link --name studyflow37

# העלה לפרודקשן
netlify deploy --prod --dir .
```

## שיטה 2: GitHub Push (אוטומטי)
הפרויקט מחובר ל-GitHub. כל push ל-main → deploy אוטומטי.
