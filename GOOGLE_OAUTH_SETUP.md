# Google OAuth Setup Instructions

## Adding Authorized Redirect URI

To enable Google Calendar authentication in your application, you need to add the application URL as an authorized redirect URI in your Google Cloud Console.

### Steps:

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Select Your Project**
   - Navigate to the project associated with your OAuth credentials
   - Client ID: `839967078225-1ljq2t2nhgh2h2io55cgkmvul4sn8r4v.apps.googleusercontent.com`

3. **Navigate to Credentials**
   - In the left sidebar, click on "APIs & Services" → "Credentials"

4. **Edit OAuth 2.0 Client ID**
   - Find your OAuth 2.0 Client ID in the list
   - Click on the client ID name to edit it

5. **Add Authorized JavaScript Origins**
   - Scroll down to "Authorized JavaScript origins"
   - Click "+ ADD URI"
   - Add: `https://3000-i6n6bk8tn9yc9n1gujofw-eeec086d.manusvm.computer`

6. **Add Authorized Redirect URIs**
   - Scroll down to "Authorized redirect URIs"
   - Click "+ ADD URI"
   - Add: `https://3000-i6n6bk8tn9yc9n1gujofw-eeec086d.manusvm.computer`
   - Also add: `https://3000-i6n6bk8tn9yc9n1gujofw-eeec086d.manusvm.computer/`

7. **Save Changes**
   - Click the "SAVE" button at the bottom
   - Wait a few moments for the changes to propagate (usually instant)

8. **Return to Application**
   - Refresh your application page
   - Click "Sign in to Google Calendar"
   - You should now be able to authenticate successfully

### Current Application URL:
```
https://3000-i6n6bk8tn9yc9n1gujofw-eeec086d.manusvm.computer
```

### Important Notes:
- The URL must match exactly (including protocol: https://)
- Changes typically take effect immediately, but can take up to 5 minutes
- If you redeploy the application, the URL may change and you'll need to update the URIs again
- For production use, you should use a custom domain instead of the temporary sandbox URL

### Troubleshooting:
If you still see authentication errors after adding the URIs:
1. Clear your browser cache and cookies
2. Try in an incognito/private browsing window
3. Wait a few minutes and try again
4. Verify the URIs were saved correctly in Google Cloud Console
