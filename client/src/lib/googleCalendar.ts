import { gapi } from 'gapi-script';

const CLIENT_ID = '839967078225-1ljq2t2nhgh2h2io55cgkmvul4sn8r4v.apps.googleusercontent.com';
const API_KEY = 'AIzaSyAUXmnozR1UJuaV2TLwyLcJY9XDoYrcDhA';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

let isInitialized = false;
let isSignedIn = false;

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

export const initGoogleCalendar = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (isInitialized) {
      resolve();
      return;
    }

    gapi.load('client:auth2', async () => {
      try {
        await gapi.client.init({
          apiKey: API_KEY,
          clientId: CLIENT_ID,
          discoveryDocs: DISCOVERY_DOCS,
          scope: SCOPES,
        });

        isInitialized = true;
        
        // Listen for sign-in state changes
        gapi.auth2.getAuthInstance().isSignedIn.listen((signedIn: boolean) => {
          isSignedIn = signedIn;
        });

        // Check if user is already signed in
        isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
        
        resolve();
      } catch (error) {
        console.error('Error initializing Google Calendar API:', error);
        reject(error);
      }
    });
  });
};

export const signIn = async (): Promise<void> => {
  try {
    await gapi.auth2.getAuthInstance().signIn();
    isSignedIn = true;
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
};

export const signOut = async (): Promise<void> => {
  try {
    await gapi.auth2.getAuthInstance().signOut();
    isSignedIn = false;
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export const isUserSignedIn = (): boolean => {
  return isSignedIn;
};

export const getCalendarList = async (): Promise<any[]> => {
  try {
    const response = await gapi.client.request({
      path: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    });
    return response.result.items || [];
  } catch (error) {
    console.error('Error fetching calendar list:', error);
    return [];
  }
};

export const getEvents = async (
  calendarId: string = 'primary',
  timeMin?: Date,
  timeMax?: Date
): Promise<GoogleCalendarEvent[]> => {
  try {
    const params: any = {
      calendarId,
      timeMin: (timeMin || new Date()).toISOString(),
      timeMax: (timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)).toISOString(),
      showDeleted: false,
      singleEvents: true,
      maxResults: 250,
      orderBy: 'startTime',
    };

    const response = await gapi.client.calendar.events.list(params);
    return response.result.items || [];
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
};

export const getAllCalendarEvents = async (
  timeMin?: Date,
  timeMax?: Date
): Promise<{ calendarName: string; events: GoogleCalendarEvent[] }[]> => {
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
