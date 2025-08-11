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
    className="h-5 w-5 text-gray-500"
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
    className="h-12 w-12 mx-auto text-gray-500"
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

const PasteIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 mr-2"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2h-1.586A1 1 0 0112 2.414L10.414 1A1 1 0 019.586 1H8zm2 6a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-16 w-16 text-green-400 mx-auto"
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

const ExclamationIcon = ({ className = "h-5 w-5 text-red-500" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
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
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-200"></div>
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
    className={`bg-gray-800 rounded-xl shadow-lg transition-all duration-500 ease-in-out transform-gpu ${
      isActive
        ? "opacity-100 ring-2 ring-indigo-500 scale-100"
        : "opacity-60 scale-95"
    }`}
  >
    <div className="p-4 sm:p-6">
      <div className="flex items-center">
        <div
          className={`flex items-center justify-center h-10 w-10 rounded-full transition-colors duration-300 ${
            isActive
              ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg"
              : "bg-gray-700 text-gray-400"
          }`}
        >
          {step}
        </div>
        <h2 className="ml-4 text-xl font-semibold text-gray-200">{title}</h2>
      </div>
      {isActive && (
        <div className="mt-6 pl-0 sm:pl-14 transition-all duration-500 ease-in-out">
          {children}
        </div>
      )}
    </div>
  </div>
);

export default function App() {
  const [userName, setUserName] = useState(
    () => localStorage.getItem("userName") || "",
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedShifts, setExtractedShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [gapiInitialized, setGapiInitialized] = useState(false);
  const [gisInitialized, setGisInitialized] = useState(false);
  const [tokenClient, setTokenClient] = useState<any>(null);

  const [isSignedIn, setIsSignedIn] = useState(
    () => localStorage.getItem("isSignedIn") === "true",
  );
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(
    () => localStorage.getItem("selectedCalendarId") || null,
  );
  const [forceAdd, setForceAdd] = useState(false);

  const [appStep, setAppStep] = useState<AppStep>("CONFIG");

  useEffect(() => {
    localStorage.setItem("userName", userName);
  }, [userName]);

  useEffect(() => {
    localStorage.setItem("isSignedIn", isSignedIn.toString());
  }, [isSignedIn]);

  useEffect(() => {
    if (selectedCalendarId) {
      localStorage.setItem("selectedCalendarId", selectedCalendarId);
    }
  }, [selectedCalendarId]);

  const listCalendars = useCallback(async () => {
    if (!isSignedIn) return;
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
      console.error("Error listing calendars:", e);
      setError(
        `Failed to list calendars: ${
          e.result?.error?.message || e.message || "Unknown error"
        }`,
      );
    }
  }, [isSignedIn, selectedCalendarId]);

  useEffect(() => {
    if (!API_KEY || !GOOGLE_CLIENT_ID) {
      setError(
        "Application is not configured correctly. API credentials were not found. Please check the environment variables.",
      );
      return;
    }

    const gapiScript = document.createElement("script");
    gapiScript.src = "https://apis.google.com/js/api.js";
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => {
      window.gapi.load("client", () => {
        window.gapi.client
          .init({})
          .then(() => {
            window.gapi.client
              .load("calendar", "v3")
              .then(() => {
                setGapiInitialized(true);
              })
              .catch((err: any) => {
                console.error("Error loading Google Calendar API:", err);
                setError(
                  `Failed to load Google Calendar API: ${
                    err.details || err.message
                  }`,
                );
              });
          })
          .catch((err: any) => {
            console.error("Error initializing GAPI client:", err);
            setError(
              `Failed to initialize Google Calendar API: ${
                err.details || err.message
              }`,
            );
          });
      });
    };
    document.body.appendChild(gapiScript);

    const gisScript = document.createElement("script");
    gisScript.src = "https://accounts.google.com/gsi/client";
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: SCOPES,
          callback: (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
              if (window.gapi && window.gapi.client) {
                window.gapi.client.setToken({
                  access_token: tokenResponse.access_token,
                });
                setIsSignedIn(true);
                setError(null);
                // Call listCalendars here to ensure token is set
                listCalendars();
              } else {
                setError("Google API client not ready.");
              }
            } else {
              setError("Authentication failed. Please try again.");
              setIsSignedIn(false);
            }
          },
          error_callback: (error: any) => {
            console.error("Google Sign-In Error:", error);
            setError(
              `Google Sign-In failed: ${
                error.message ||
                "Please check your configuration and try again."
              }`,
            );
          },
        });
        setTokenClient(() => client);
        setGisInitialized(true);
      } catch (err: any) {
        console.error("Error initializing Google Identity Services:", err);
        setError(
          `Failed to initialize sign-in service: ${
            err.message || "Unknown error"
          }`,
        );
      }
    };
    document.body.appendChild(gisScript);

    return () => {
      document.body.removeChild(gapiScript);
      document.body.removeChild(gisScript);
    };
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      listCalendars();
    }
  }, [isSignedIn, listCalendars]);

  const handleSignIn = () => {
    if (tokenClient && gapiInitialized && gisInitialized) {
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
        localStorage.removeItem("isSignedIn");
        localStorage.removeItem("selectedCalendarId");
      });
    } else {
      setIsSignedIn(false);
      setAppStep("CONFIG");
      setSelectedCalendarId(null);
      setCalendars([]);
      localStorage.removeItem("isSignedIn");
      localStorage.removeItem("selectedCalendarId");
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

  const handlePasteFromClipboard = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const file = new File([blob], "pasted-image.png", {
              type: blob.type,
            });
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setError(null);
            setAppStep("UPLOAD");
            return;
          }
        }
      }
      setError("No image found in clipboard.");
    } catch (err) {
      console.error("Failed to read clipboard contents: ", err);
      setError("Failed to paste image. Please try again or select a file.");
    }
  };

  const checkForConflicts = async (shifts: Shift[]) => {
    if (!selectedCalendarId || shifts.length === 0) return shifts;

    setLoadingMessage("Checking for conflicting events...");
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const minDate = shifts.reduce(
      (min, s) => (s.date < min ? s.date : min),
      shifts[0].date,
    );
    const maxDate = shifts.reduce(
      (max, s) => (s.date > max ? s.date : max),
      shifts[0].date,
    );

    try {
      const response = await window.gapi.client.calendar.events.list({
        calendarId: selectedCalendarId,
        timeMin: `${minDate}T00:00:00Z`,
        timeMax: `${maxDate}T23:59:59Z`,
        singleEvents: true,
        orderBy: "startTime",
      });

      const existingEvents = response.result.items;
      if (existingEvents.length === 0) return shifts;

      const updatedShifts = shifts.map((shift) => {
        const shiftStart = new Date(
          `${shift.date}T${shift.startTime}`,
        ).getTime();
        const shiftEnd = new Date(`${shift.date}T${shift.endTime}`).getTime();
        const isConflicting = existingEvents.some((event: any) => {
          const eventStart = new Date(event.start.dateTime).getTime();
          const eventEnd = new Date(event.end.dateTime).getTime();
          return shiftStart < eventEnd && shiftEnd > eventStart;
        });
        return { ...shift, isConflicting };
      });

      return updatedShifts;
    } catch (e: any) {
      console.error("Error checking for conflicts:", e);
      setError(
        `Could not check for calendar conflicts: ${
          e.result?.error?.message || "Unknown error"
        }`,
      );
      // Return original shifts if conflict check fails
      return shifts;
    }
  };

  const handleExtractShifts = async () => {
    if (!imageFile || !userName || !API_KEY) return;
    setIsLoading(true);
    setLoadingMessage("AI is analyzing your schedule...");
    setError(null);
    try {
      const initialShifts = await extractShiftsFromImage(
        imageFile,
        userName,
        API_KEY,
      );
      if (initialShifts.length > 0) {
        const shiftsWithConflicts = await checkForConflicts(initialShifts);
        setExtractedShifts(shiftsWithConflicts);
        setAppStep("REVIEW");
      } else {
        setError(
          `No shifts found for "${userName}". Please check the name spelling or upload a different image.`,
        );
        setAppStep("UPLOAD");
      }
    } catch (e: any) {
      setError(e.message || "An unknown error occurred during analysis.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddShiftsToCalendar = async () => {
    if (!selectedCalendarId || extractedShifts.length === 0 || !gapiInitialized)
      return;

    const shiftsToAdd = forceAdd
      ? extractedShifts
      : extractedShifts.filter((s) => !s.isConflicting);

    if (shiftsToAdd.length === 0) {
      setError("No shifts to add. All found shifts have conflicts.");
      setAppStep("REVIEW");
      return;
    }

    setAppStep("ADDING");
    setLoadingMessage(
      `Adding ${shiftsToAdd.length} shifts to your calendar...`,
    );
    setError(null);

    const promises = shiftsToAdd.map((shift) => {
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
    setForceAdd(false);
    setAppStep("UPLOAD");
  };

  const handleBackToConfig = () => {
    setAppStep("CONFIG");
  };

  const isConfigComplete =
    userName.trim() !== "" && isSignedIn && selectedCalendarId !== null;
  const isApiReady = gisInitialized && gapiInitialized;
  const conflictingShiftCount = extractedShifts.filter(
    (s) => s.isConflicting,
  ).length;

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
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center py-8 px-4 sm:px-6 lg:px-8">
      <header className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent tracking-tight">
          Shift Sync AI
        </h1>
        <p className="mt-3 text-lg sm:text-xl text-gray-400">
          Upload your work schedule and let AI add it to your calendar ✨
        </p>
      </header>

      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg mb-6 w-full max-w-2xl flex items-center shadow-lg animate-pulse">
          <ExclamationIcon className="h-5 w-5 text-red-400" />
          <span className="ml-3">{error}</span>
        </div>
      )}

      <main className="w-full max-w-2xl space-y-6">
        <StepCard
          title="Configuration"
          step={1}
          isActive={appStep === "CONFIG"}
        >
          <div className="space-y-6">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Your Name (as it appears in the schedule)
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <UserIcon />
                </div>
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm bg-gray-700 border-gray-600 rounded-lg py-3 px-4 text-gray-200 placeholder-gray-500"
                  placeholder="e.g., אלכס, Alex, or אברהם"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Enter your name exactly as it appears in Hebrew or English in
                the schedule
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Google Calendar Connection
              </label>
              <div className="mt-1">
                {!isSignedIn ? (
                  <button
                    onClick={handleSignIn}
                    disabled={!isApiReady}
                    className="w-full flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
                  >
                    {getSignInButtonText()}
                  </button>
                ) : (
                  <div className="space-y-3">
                    <select
                      id="calendar"
                      name="calendar"
                      value={selectedCalendarId || ""}
                      onChange={(e) => setSelectedCalendarId(e.target.value)}
                      className="block w-full px-4 py-3 text-base bg-gray-700 border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg text-gray-200"
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
                      className="text-sm text-gray-400 hover:text-indigo-400 transition-colors"
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
          <div className="flex justify-end mb-4">
            <button
              onClick={handleBackToConfig}
              className="text-sm font-medium text-gray-400 hover:text-indigo-400 transition-colors"
            >
              &larr; Back to Configuration
            </button>
          </div>
          <div className="border-2 border-dashed border-gray-600 rounded-xl hover:border-indigo-500 transition-colors duration-200 bg-gray-800/50">
            <div className="px-6 py-8">
              <div className="text-center">
                <UploadIcon />
                <div className="mt-4 space-y-2 sm:space-y-0 sm:flex sm:justify-center sm:space-x-4">
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-indigo-300 bg-indigo-900/50 hover:bg-indigo-800/50 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 transition-all duration-200"
                  >
                    Choose file
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
                  <button
                    onClick={handlePasteFromClipboard}
                    className="inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-lg text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                    disabled={!isConfigComplete}
                  >
                    <PasteIcon />
                    Paste from Clipboard
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500">or drag and drop</p>
              </div>
            </div>
          </div>

          {imagePreview && appStep !== "REVIEW" && (
            <div className="mt-6 animate-fade-in">
              <p className="text-sm font-medium text-gray-300 mb-3">
                Image Preview:
              </p>
              <div className="rounded-lg overflow-hidden shadow-lg">
                <img
                  src={imagePreview}
                  alt="Schedule preview"
                  className="w-full h-auto max-h-80 object-contain bg-gray-800"
                />
              </div>
            </div>
          )}

          {appStep === "UPLOAD" && imageFile && (
            <div className="mt-6">
              <button
                onClick={handleExtractShifts}
                disabled={isLoading || !isConfigComplete}
                className="w-full flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-lg text-base font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
              >
                {isLoading ? (
                  <>
                    <Spinner />
                    <span className="ml-3">{loadingMessage}</span>
                  </>
                ) : (
                  "✨ Extract Shifts with AI"
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
          <div className="space-y-4">
            <div className="bg-green-900/50 border border-green-700 p-4 rounded-lg">
              <p className="text-sm text-green-300">
                Found{" "}
                <span className="font-bold">{extractedShifts.length}</span>{" "}
                shifts for <span className="font-semibold">{userName}</span>.
                Please review before adding to your calendar.
              </p>
            </div>

            {conflictingShiftCount > 0 && (
              <div className="bg-yellow-900/50 border border-yellow-700 text-yellow-300 p-4 rounded-lg flex items-start">
                <ExclamationIcon className="h-5 w-5 text-yellow-400 mt-0.5" />
                <div className="ml-3">
                  <p className="font-semibold">
                    {conflictingShiftCount} Conflicting Events Found
                  </p>
                  <p className="text-sm">
                    Some shifts overlap with existing events in your calendar.
                    They are marked in red.
                  </p>
                  <div className="mt-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={forceAdd}
                        onChange={(e) => setForceAdd(e.target.checked)}
                        className="h-4 w-4 text-indigo-500 focus:ring-indigo-400 bg-gray-700 border-gray-600 rounded"
                      />
                      <span className="ml-2 text-sm">
                        Add conflicting shifts anyway
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="max-h-80 overflow-y-auto pr-2">
              <ul className="space-y-3">
                {extractedShifts.map((shift, index) => (
                  <li
                    key={index}
                    className={`p-4 rounded-lg border flex items-center space-x-4 transition-all duration-300 ${
                      shift.isConflicting
                        ? "bg-red-900/50 border-red-700"
                        : "bg-gray-800/50 border-gray-700 hover:shadow-indigo-500/10 hover:shadow-lg"
                    }`}
                  >
                    {shift.isConflicting ? (
                      <ExclamationIcon className="h-6 w-6 mr-2 text-red-400" />
                    ) : (
                      <CalendarIcon />
                    )}
                    <div className="flex-grow">
                      <p
                        className={`font-semibold ${
                          shift.isConflicting ? "text-red-300" : "text-gray-200"
                        }`}
                      >
                        {shift.date} ({shift.dayOfWeek})
                      </p>
                      <p
                        className={`text-sm ${
                          shift.isConflicting ? "text-red-400" : "text-gray-400"
                        }`}
                      >
                        {shift.startTime} - {shift.endTime} at{" "}
                        <span className="font-medium text-indigo-400">
                          {shift.location}
                        </span>
                        {shift.isConflicting && (
                          <span className="font-bold ml-2">(Conflict)</span>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-gray-700">
              <button
                onClick={handleStartOver}
                className="text-sm font-medium text-gray-400 hover:text-indigo-400 transition-colors mb-4 sm:mb-0"
              >
                ← Start Over
              </button>
              <button
                onClick={handleAddShiftsToCalendar}
                disabled={
                  !forceAdd &&
                  conflictingShiftCount === extractedShifts.length &&
                  extractedShifts.length > 0
                }
                className="w-full sm:w-auto px-6 py-3 border border-transparent rounded-lg shadow-lg text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
              >
                📅 Add to Calendar
              </button>
            </div>
          </div>
        </StepCard>

        {(appStep === "ADDING" || appStep === "DONE") && (
          <div className="bg-gray-800 rounded-xl shadow-lg p-8 text-center animate-fade-in">
            {appStep === "ADDING" ? (
              <>
                <div className="flex justify-center mb-6">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400"></div>
                </div>
                <h2 className="text-2xl font-semibold text-gray-200 mb-2">
                  {loadingMessage}
                </h2>
                <p className="text-gray-400">Please wait...</p>
              </>
            ) : (
              <>
                <CheckCircleIcon />
                <h2 className="mt-6 text-3xl font-bold text-gray-100">
                  Success! 🎉
                </h2>
                <p className="mt-3 text-lg text-gray-300">
                  {
                    extractedShifts.filter((s) => forceAdd || !s.isConflicting)
                      .length
                  }{" "}
                  shifts have been added to your calendar.
                </p>
                <button
                  onClick={handleStartOver}
                  className="mt-8 px-8 py-3 border border-transparent rounded-lg shadow-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 transform hover:scale-105"
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
