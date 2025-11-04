/// <reference types="google.accounts" />
/// <reference types="gapi" />
/// <reference types="gapi.client.calendar" />

declare const gapi: any;

const CLIENT_ID = '839967078225-1ljq2t2nhgh2h2io55cgkmvul4sn8r4v.apps.googleusercontent.com';
const API_KEY = 'AIzaSyAUXmnozR1UJuaV2TLwyLcJY9XDoYrcDhA';
const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events';

let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;
let gapiInited = false;

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

// Initialize GAPI client
export const initGapi = async (): Promise<void> => {
  if (gapiInited) return;

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = async () => {
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
    };
    document.head.appendChild(script);
  });
};

// Initialize Google Identity Services
export const initGIS = (): Promise<void> => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: () => {}, // Will be overridden during request
      });
      resolve();
    };
    document.head.appendChild(script);
  });
};

// Initialize both GAPI and GIS
export const initGoogleCalendar = async (): Promise<void> => {
  await Promise.all([initGapi(), initGIS()]);
};

// Request access token
export const signIn = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Token client not initialized'));
      return;
    }

    (tokenClient as any).callback = async (response: google.accounts.oauth2.TokenResponse) => {
      if (response.error) {
        reject(response);
        return;
      }
      accessToken = response.access_token;
      gapi.client.setToken({ access_token: accessToken });
      resolve(accessToken);
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

// Sign out
export const signOut = (): void => {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {
      console.log('Access token revoked');
    });
    accessToken = null;
    gapi.client.setToken(null);
  }
};

// Check if user is signed in
export const isUserSignedIn = (): boolean => {
  return accessToken !== null;
};

// Get calendar list
export const getCalendarList = async (): Promise<any[]> => {
  try {
    const response = await gapi.client.calendar.calendarList.list();
    return response.result.items || [];
  } catch (error) {
    console.error('Error fetching calendar list:', error);
    return [];
  }
};

// Get events from a specific calendar
export const getEvents = async (
  calendarId: string = 'primary',
  timeMin?: Date,
  timeMax?: Date
): Promise<GoogleCalendarEvent[]> => {
  try {
    const response = await gapi.client.calendar.events.list({
      calendarId,
      timeMin: (timeMin || new Date()).toISOString(),
      timeMax: (timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).toISOString(),
      showDeleted: false,
      singleEvents: true,
      maxResults: 250,
      orderBy: 'startTime',
    });
    return response.result.items || [];
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
};

// Get events from all calendars
export const getAllCalendarEvents = async (
  timeMin?: Date,
  timeMax?: Date
): Promise<{ calendarName: string; events: GoogleCalendarEvent[]; backgroundColor?: string }[]> => {
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
    return [];
  }
};

// Create a new event
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
    const response = await gapi.client.calendar.events.insert({
      calendarId,
      resource: event,
    });
    return response.result;
  } catch (error) {
    console.error('Error creating event:', error);
    return null;
  }
};

// Update an existing event
export const updateEvent = async (
  calendarId: string = 'primary',
  eventId: string,
  event: Partial<GoogleCalendarEvent>
): Promise<GoogleCalendarEvent | null> => {
  try {
    const response = await gapi.client.calendar.events.patch({
      calendarId,
      eventId,
      resource: event,
    });
    return response.result;
  } catch (error) {
    console.error('Error updating event:', error);
    return null;
  }
};

// Delete an event
export const deleteEvent = async (
  calendarId: string = 'primary',
  eventId: string
): Promise<boolean> => {
  try {
    await gapi.client.calendar.events.delete({
      calendarId,
      eventId,
    });
    return true;
  } catch (error) {
    console.error('Error deleting event:', error);
    return false;
  }
};

// Convert Google Calendar color to hex
export const getColorForEvent = (colorId?: string): string => {
  const colorMap: { [key: string]: string } = {
    '1': '#a4bdfc', // Lavender
    '2': '#7ae7bf', // Sage
    '3': '#dbadff', // Grape
    '4': '#ff887c', // Flamingo
    '5': '#fbd75b', // Banana
    '6': '#ffb878', // Tangerine
    '7': '#46d6db', // Peacock
    '8': '#e1e1e1', // Graphite
    '9': '#5484ed', // Blueberry
    '10': '#51b749', // Basil
    '11': '#dc2127', // Tomato
  };
  return colorMap[colorId || '9'] || '#3b82f6';
};
