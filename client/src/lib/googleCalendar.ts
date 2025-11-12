// Google Calendar API integration
/// <reference types="gapi" />
/// <reference types="gapi.client.calendar" />

// Global type declarations for Google APIs
declare const gapi: any;
declare const google: any;

// SECURITY WARNING: These credentials should be in environment variables
// For production, move to server-side or use proper OAuth flow
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '839967078225-1ljq2t2nhgh2h2io55cgkmvul4sn8r4v.apps.googleusercontent.com';
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || 'AIzaSyAUXmnozR1UJuaV2TLwyLcJY9XDoYrcDhA';
const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/drive.file';

let tokenClient: any | null = null;
let accessToken: string | null = null;
let gapiInited = false;
let gisInited = false;

/**
 * Get the current access token
 */
export const getAccessToken = (): string | null => {
  return accessToken;
};

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  colorId?: string;
  description?: string;
  location?: string;
  recurrence?: string[];
}

/**
 * Initialize GAPI client library
 */
export const initGapi = async (): Promise<void> => {
  if (gapiInited) return;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Failed to load GAPI script'));
    script.onload = async () => {
      try {
        await new Promise<void>((resolveLoad) => {
          gapi.load('client', async () => {
            await gapi.client.init({
              apiKey: API_KEY,
              discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
            });
            gapiInited = true;
            resolveLoad();
          });
        });
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    document.head.appendChild(script);
  });
};

/**
 * Initialize Google Identity Services
 */
export const initGIS = (): Promise<void> => {
  if (gisInited) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error('Failed to load GIS script'));
    script.onload = () => {
      try {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: () => {}, // Will be overridden during request
        });
        gisInited = true;
        resolve();
      } catch (error) {
        reject(error);
      }
    };
    document.head.appendChild(script);
  });
};

/**
 * Initialize both GAPI and GIS
 */
export const initGoogleCalendar = async (): Promise<void> => {
  await Promise.all([initGapi(), initGIS()]);
};

/**
 * Request access token and sign in user
 */
export const signIn = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Token client not initialized. Call initGoogleCalendar() first.'));
      return;
    }

    tokenClient.callback = async (response: any) => {
      if (response.error) {
        // Provide detailed error information
        let errorMessage = `Google OAuth Error: ${response.error}`;
        
        if (response.error === 'access_denied') {
          errorMessage += '\n\nThis usually means:\n' +
            '1. The OAuth app is set to "Internal" - Change to "External" in Google Cloud Console\n' +
            '2. The app is in "Testing" mode and your email is not added as a test user\n' +
            '3. You clicked "Cancel" on the consent screen\n\n' +
            'To fix:\n' +
            '• Go to Google Cloud Console → APIs & Services → OAuth consent screen\n' +
            '• Change User Type to "External" OR add your email under "Test users"';
        }
        
        if (response.error_description) {
          errorMessage += `\n\nDetails: ${response.error_description}`;
        }
        
        console.error('OAuth Error Details:', response);
        reject(new Error(errorMessage));
        return;
      }
      accessToken = response.access_token;
      gapi.client.setToken({ access_token: accessToken });
      resolve(accessToken!);
    };

    // Add error handler for popup blocked or other issues
    tokenClient.error_callback = (error: any) => {
      console.error('OAuth Error Callback:', error);
      reject(new Error(`OAuth failed: ${error.type || 'unknown error'}`));
    };

    if (accessToken) {
      // Skip display of account chooser and consent dialog for an existing session
      tokenClient.requestAccessToken({ prompt: '' });
    } else {
      // Prompt the user to select a Google Account and ask for consent
      tokenClient.requestAccessToken({ prompt: 'consent' });
    }
  });
};

/**
 * Sign out and revoke access token
 */
export const signOut = (): void => {
  if (accessToken && typeof google !== 'undefined' && google.accounts?.oauth2) {
    google.accounts.oauth2.revoke(accessToken, () => {
      console.log('Access token revoked');
    });
    accessToken = null;
    gapi.client.setToken(null);
  }
};

/**
 * Check if user is currently signed in
 */
export const isSignedIn = (): boolean => {
  return !!accessToken;
};

/**
 * Get list of user's calendars
 */
export const getCalendarList = async (): Promise<any[]> => {
  try {
    if (!gapiInited) {
      throw new Error('Google API not initialized. Call initGoogleCalendar() first.');
    }
    if (!accessToken) {
      throw new Error('User not signed in');
    }
    const response = await gapi.client.calendar.calendarList.list();
    return response.result.items || [];
  } catch (error) {
    console.error('Error fetching calendar list:', error);
    throw error;
  }
};

/**
 * Get events from a specific calendar with pagination support
 * @param calendarId Calendar ID (default: 'primary')
 * @param timeMin Start time for event search
 * @param timeMax End time for event search
 */
export const getEvents = async (
  calendarId: string = 'primary',
  timeMin?: Date,
  timeMax?: Date
): Promise<GoogleCalendarEvent[]> => {
  try {
    if (!gapiInited) {
      throw new Error('Google API not initialized. Call initGoogleCalendar() first.');
    }
    if (!accessToken) {
      throw new Error('User not signed in');
    }

    const allEvents: GoogleCalendarEvent[] = [];
    let pageToken: string | undefined = undefined;
    
    // Fetch all pages of events
    do {
      const response: any = await gapi.client.calendar.events.list({
        calendarId,
        timeMin: (timeMin || new Date()).toISOString(),
        timeMax: (timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).toISOString(),
        showDeleted: false,
        singleEvents: true,
        maxResults: 250, // Max per page
        orderBy: 'startTime',
        pageToken, // Use page token for subsequent requests
      });
      
      const events = response.result.items || [];
      allEvents.push(...events);
      
      // Get next page token if there are more results
      pageToken = response.result.nextPageToken;
    } while (pageToken);
    
    return allEvents;
  } catch (error: any) {
    console.error('Error fetching events:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      result: error.result,
      calendarId
    });
    // Return empty array instead of throwing to allow other calendars to sync
    return [];
  }
};

/**
 * Get events from all calendars
 */
export const getAllCalendarEvents = async (
  timeMin?: Date,
  timeMax?: Date
): Promise<{ calendarName: string; calendarId: string; events: GoogleCalendarEvent[]; backgroundColor?: string }[]> => {
  try {
    const calendars = await getCalendarList();
    const allEvents = await Promise.all(
      calendars.map(async (calendar) => {
        const events = await getEvents(calendar.id, timeMin, timeMax);
        return {
          calendarName: calendar.summary,
          calendarId: calendar.id,
          backgroundColor: calendar.backgroundColor,
          events,
        };
      })
    );
    return allEvents;
  } catch (error) {
    console.error('Error fetching all calendar events:', error);
    throw error;
  }
};

/**
 * Create a new event in a calendar
 */
export const createEvent = async (
  calendarId: string = 'primary',
  event: {
    summary: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    description?: string;
    location?: string;
    recurrence?: string[];
  }
): Promise<GoogleCalendarEvent | null> => {
  try {
    if (!gapiInited) {
      throw new Error('Google API not initialized');
    }
    if (!accessToken) {
      throw new Error('User not signed in');
    }
    const response = await gapi.client.calendar.events.insert({
      calendarId,
      resource: event,
    });
    return response.result;
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
};

/**
 * Update an existing event
 */
export const updateEvent = async (
  calendarId: string = 'primary',
  eventId: string,
  event: {
    summary?: string;
    start?: { dateTime: string; timeZone?: string };
    end?: { dateTime: string; timeZone?: string };
    description?: string;
    location?: string;
    recurrence?: string[];
  }
): Promise<GoogleCalendarEvent | null> => {
  try {
    if (!gapiInited) {
      throw new Error('Google API not initialized');
    }
    if (!accessToken) {
      throw new Error('User not signed in');
    }
    const response = await gapi.client.calendar.events.patch({
      calendarId,
      eventId,
      resource: event,
    });
    return response.result;
  } catch (error) {
    console.error('Error updating event:', error);
    throw error;
  }
};

/**
 * Delete an event from a calendar
 */
export const deleteEvent = async (
  calendarId: string = 'primary',
  eventId: string
): Promise<boolean> => {
  try {
    if (!gapiInited) {
      throw new Error('Google API not initialized');
    }
    if (!accessToken) {
      throw new Error('User not signed in');
    }
    await gapi.client.calendar.events.delete({
      calendarId,
      eventId,
    });
    return true;
  } catch (error) {
    console.error('Error deleting event:', error);
    throw error;
  }
};

/**
 * Upload a file to Google Drive
 */
export const uploadToGoogleDrive = async (
  fileBlob: Blob,
  fileName: string,
  mimeType: string = 'application/pdf'
): Promise<{ id: string; webViewLink: string } | null> => {
  try {
    if (!gapiInited) {
      throw new Error('Google API not initialized');
    }
    if (!accessToken) {
      throw new Error('User not signed in');
    }

    // Load the Drive API client if not already loaded
    if (!gapi.client.drive) {
      await gapi.client.load('drive', 'v3');
    }

    // Create metadata
    const metadata = {
      name: fileName,
      mimeType: mimeType,
    };

    // Create form data for multipart upload
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileBlob);

    // Upload file using fetch (gapi.client doesn't support multipart uploads well)
    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      }
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error uploading to Google Drive:', error);
    throw error;
  }
};
