import React, { useState, useEffect, useCallback } from "react";
import { Shift, GoogleCalendar } from "./types";
import { extractShiftsFromImage } from "./services/geminiService";

declare global {
  interface Window {
    gapi: any;
    google: any; // For Google Identity Services
  }
}

const API_KEY = import.meta.env.VITE_API_KEY;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const SCOPES =
  "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";

// --- SVG Icons ---
const CalendarIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6 mr-2"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);
const UserIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 text-gray-400"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
      clipRule="evenodd"
    />
  </svg>
);
const UploadIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-12 w-12 mx-auto text-gray-400"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
    />
  </svg>
);
const CheckCircleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-16 w-16 text-green-500 mx-auto"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);
const ExclamationIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 text-red-500"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.21 3.001-1.742 3.001H4.42c-1.532 0-2.492-1.667-1.742-3.001l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
      clipRule="evenodd"
    />
  </svg>
);
const Spinner = () => (
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
);

type AppStep = "CONFIG" | "UPLOAD" | "REVIEW" | "ADDING" | "DONE";

// --- UI Components ---
interface StepCardProps {
  title: string;
  step: number;
  isActive: boolean;
  children: React.ReactNode;
}

const StepCard: React.FC<StepCardProps> = ({
  title,
  step,
  isActive,
  children,
}) => (
  <div
    className={`bg-white rounded-xl shadow-md transition-all duration-500 ${isActive ? "opacity-100" : "opacity-50"}`}
  >
    <div className="p-6">
      <div className="flex items-center">
        <div
          className={`flex items-center justify-center h-8 w-8 rounded-full ${isActive ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-600"}`}
        >
          {step}
        </div>
        <h2 className="ml-4 text-xl font-semibold text-gray-700">{title}</h2>
      </div>
      {isActive && <div className="mt-4 pl-12">{children}</div>}
    </div>
  </div>
);

export default function App() {
  const [userName, setUserName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedShifts, setExtractedShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [isSignedIn, setIsSignedIn] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(
    null,
  );

  const [appStep, setAppStep] = useState<AppStep>("CONFIG");
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [gapiReady, setGapiReady] = useState(false);

  useEffect(() => {
    if (!API_KEY || !GOOGLE_CLIENT_ID) {
      setError(
        "Application is not configured correctly. API credentials were not found. Please check the environment variables.",
      );
    }
  }, []);

  const listCalendars = useCallback(async () => {
    if (!gapiReady) return;
    try {
      const response = await window.gapi.client.calendar.calendarList.list();
      const items = response.result.items.filter(
        (cal: any) => cal.accessRole === "owner" || cal.accessRole === "writer",
      );
      setCalendars(items);
      if (items.length > 0 && !selectedCalendarId) {
        const workCalendar = items.find((cal: GoogleCalendar) =>
          cal.summary.toLowerCase().includes("work"),
        );
        setSelectedCalendarId(workCalendar ? workCalendar.id : items[0].id);
      }
    } catch (e: any) {
      setError(
        `Failed to list calendars: ${e.result?.error?.message || "Unknown error"}`,
      );
    }
  }, [gapiReady, selectedCalendarId]);

  // Robust Google API initialization, using environment variables
  useEffect(() => {
    if (!API_KEY || !GOOGLE_CLIENT_ID) return;

    let gapiInitAttempted = false;
    let gisInitAttempted = false;

    const poll = setInterval(() => {
      const gapiIsReady = !!window.gapi?.client;
      const gisIsReady = !!window.google?.accounts?.oauth2?.initTokenClient;

      if (gapiIsReady && !gapiInitAttempted) {
        gapiInitAttempted = true;
        window.gapi.load("client", () => {
          window.gapi.client
            .init({
              apiKey: API_KEY,
              discoveryDocs: [
                "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
              ],
            })
            .then(() => {
              setGapiReady(true);
            })
            .catch((err: any) => {
              console.error("Error initializing GAPI client:", err);
              setError(
                `Failed to initialize Google Calendar API: ${err.details || err.message}`,
              );
            });
        });
      }

      if (gisIsReady && !gisInitAttempted) {
        gisInitAttempted = true;
        try {
          const client = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: (tokenResponse: any) => {
              if (tokenResponse && tokenResponse.access_token) {
                window.gapi.client.setToken({
                  access_token: tokenResponse.access_token,
                });
                setIsSignedIn(true);
                setError(null); // Clear errors on successful sign-in
              } else {
                setError("Authentication failed. Please try again.");
                setIsSignedIn(false);
              }
            },
            error_callback: (error: any) => {
              console.error("Google Sign-In Error:", error);
              setError(
                `Google Sign-In failed: ${error.message || "Please check your configuration and try again."}`,
              );
            },
          });
          setTokenClient(() => client);
        } catch (err: any) {
          console.error("Error initializing Google Identity Services:", err);
          setError(
            `Failed to initialize sign-in service: ${err.message || "Unknown error"}`,
          );
        }
      }

      if (gapiInitAttempted && gisInitAttempted) {
        clearInterval(poll);
      }
    }, 150);

    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    if (isSignedIn && gapiReady) {
      listCalendars();
    }
  }, [isSignedIn, gapiReady, listCalendars]);

  const handleSignIn = () => {
    if (tokenClient && gapiReady) {
      tokenClient.requestAccessToken();
    } else {
      setError(
        "Sign-in service is not ready yet. Please wait a moment and try again.",
      );
    }
  };

  const handleSignOut = () => {
    const token = window.gapi.client.getToken();
    if (token && window.google) {
      window.google.accounts.oauth2.revoke(token.access_token, () => {
        window.gapi.client.setToken(null);
        setIsSignedIn(false);
        setAppStep("CONFIG");
        setSelectedCalendarId(null);
        setCalendars([]);
      });
    } else {
      setIsSignedIn(false);
      setAppStep("CONFIG");
      setSelectedCalendarId(null);
      setCalendars([]);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError(null);
      setAppStep("UPLOAD");
    }
  };

  const handleExtractShifts = async () => {
    if (!imageFile || !userName || !API_KEY) return;
    setIsLoading(true);
    setLoadingMessage("AI is analyzing your schedule...");
    setError(null);
    try {
      const shifts = await extractShiftsFromImage(imageFile, userName, API_KEY);
      setExtractedShifts(shifts);
      if (shifts.length > 0) {
        setAppStep("REVIEW");
      } else {
        setError(
          "No shifts found for your name. Please check the name or upload a different image.",
        );
      }
    } catch (e: any) {
      setError(e.message || "An unknown error occurred during analysis.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddShiftsToCalendar = async () => {
    if (!selectedCalendarId || extractedShifts.length === 0 || !gapiReady)
      return;
    setAppStep("ADDING");
    setLoadingMessage(
      `Adding ${extractedShifts.length} shifts to your calendar...`,
    );
    setError(null);

    const promises = extractedShifts.map((shift) => {
      const event = {
        summary: `Work Shift: ${shift.location}`,
        location: shift.location,
        description: `Shift at ${shift.location}`,
        start: {
          dateTime: `${shift.date}T${shift.startTime}:00`,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: `${shift.date}T${shift.endTime}:00`,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };
      return window.gapi.client.calendar.events.insert({
        calendarId: selectedCalendarId,
        resource: event,
      });
    });

    try {
      await Promise.all(promises);
      setAppStep("DONE");
    } catch (e: any) {
      setError(
        `Failed to add events: ${e.result?.error?.message || "Unknown error"}`,
      );
      setAppStep("REVIEW");
    }
  };

  const handleStartOver = () => {
    setImageFile(null);
    setImagePreview(null);
    setExtractedShifts([]);
    setError(null);
    setIsLoading(false);
    setAppStep("UPLOAD");
  };

  const isConfigComplete =
    userName.trim() !== "" && isSignedIn && selectedCalendarId !== null;
  const isApiReady = tokenClient && gapiReady;

  useEffect(() => {
    if (
      isConfigComplete &&
      (appStep === "CONFIG" || (appStep === "UPLOAD" && !imageFile))
    ) {
      setAppStep("UPLOAD");
    }
  }, [isConfigComplete, appStep, imageFile]);

  const getSignInButtonText = () => {
    if (!isApiReady) return "Initializing Sign-In...";
    return "Sign in with Google";
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800 tracking-tight">
          Shift Sync AI
        </h1>
        <p className="mt-2 text-lg text-gray-500">
          Upload your work schedule and let AI add it to your calendar.
        </p>
      </header>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-6 w-full max-w-2xl flex items-center shadow">
          <ExclamationIcon />
          <span className="ml-3">{error}</span>
        </div>
      )}

      <main className="w-full max-w-2xl space-y-6">
        <StepCard
          title="Configuration"
          step={1}
          isActive={appStep === "CONFIG"}
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700"
              >
                Your Name (in Hebrew)
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon />
                </div>
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2"
                  placeholder="לדוגמא: אלכס"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Google Calendar
              </label>
              <div className="mt-1">
                {!isSignedIn ? (
                  <button
                    onClick={handleSignIn}
                    disabled={!isApiReady}
                    className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                  >
                    {getSignInButtonText()}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <select
                      id="calendar"
                      name="calendar"
                      value={selectedCalendarId || ""}
                      onChange={(e) => setSelectedCalendarId(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                      disabled={calendars.length === 0}
                    >
                      {calendars.length > 0 ? (
                        calendars.map((cal) => (
                          <option key={cal.id} value={cal.id}>
                            {cal.summary}
                          </option>
                        ))
                      ) : (
                        <option>Loading calendars...</option>
                      )}
                    </select>
                    <button
                      onClick={handleSignOut}
                      className="text-xs text-gray-500 hover:text-indigo-600"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </StepCard>

        <StepCard
          title="Upload Schedule"
          step={2}
          isActive={appStep !== "CONFIG"}
        >
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <UploadIcon />
              <div className="flex text-sm text-gray-600">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                >
                  <span>Upload a file</span>
                  <input
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={!isConfigComplete}
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
            </div>
          </div>
          {imagePreview && appStep !== "REVIEW" && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700">
                Image Preview:
              </p>
              <img
                src={imagePreview}
                alt="Schedule preview"
                className="mt-2 rounded-lg shadow-sm max-h-60 w-auto mx-auto"
              />
            </div>
          )}
          {appStep === "UPLOAD" && imageFile && (
            <div className="mt-6">
              <button
                onClick={handleExtractShifts}
                disabled={isLoading || !isConfigComplete}
                className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Spinner /> <span className="ml-3">{loadingMessage}</span>
                  </>
                ) : (
                  "Extract Shifts"
                )}
              </button>
            </div>
          )}
        </StepCard>

        <StepCard
          title="Review & Confirm"
          step={3}
          isActive={appStep === "REVIEW"}
        >
          <p className="text-sm text-gray-600">
            Found {extractedShifts.length} shifts for{" "}
            <span className="font-semibold">{userName}</span>. Please review
            before adding to your calendar.
          </p>
          <div className="mt-4 max-h-80 overflow-y-auto pr-2">
            <ul className="space-y-3">
              {extractedShifts.map((shift, index) => (
                <li
                  key={index}
                  className="bg-gray-50 p-3 rounded-md border border-gray-200 flex items-center space-x-4"
                >
                  <CalendarIcon />
                  <div className="flex-grow">
                    <p className="font-semibold text-gray-800">
                      {shift.date} ({shift.dayOfWeek})
                    </p>
                    <p className="text-sm text-gray-600">
                      {shift.startTime} - {shift.endTime} at{" "}
                      <span className="font-medium">{shift.location}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-6 flex justify-between items-center">
            <button
              onClick={handleStartOver}
              className="text-sm font-medium text-gray-600 hover:text-indigo-600"
            >
              Start Over
            </button>
            <button
              onClick={handleAddShiftsToCalendar}
              className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Add to Calendar
            </button>
          </div>
        </StepCard>

        {(appStep === "ADDING" || appStep === "DONE") && (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            {appStep === "ADDING" ? (
              <>
                <div className="flex justify-center mb-4">
                  <Spinner />
                </div>
                <h2 className="text-xl font-semibold text-gray-700">
                  {loadingMessage}
                </h2>
                <p className="text-gray-500 mt-2">Please wait...</p>
              </>
            ) : (
              <>
                <CheckCircleIcon />
                <h2 className="mt-4 text-2xl font-bold text-gray-800">
                  Success!
                </h2>
                <p className="mt-2 text-gray-600">
                  {extractedShifts.length} shifts have been added to your
                  calendar.
                </p>
                <button
                  onClick={handleStartOver}
                  className="mt-6 px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Process Another Schedule
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
