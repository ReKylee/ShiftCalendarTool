import React, { useState, useEffect, useCallback } from "react";
import { Shift, GoogleCalendar } from "./types";
import { extractShiftsFromImage } from "./services/geminiService";
import { motion, AnimatePresence } from "framer-motion";

// --- Declarations, Interfaces, and SVGs ---
declare global {
  interface Window {
    gapi: any;
    google: any; // For Google Identity Services
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const SCOPES =
  "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";

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

const CheckIcon = () => (
  <svg
    className="w-6 h-6 text-white"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3"
      d="M5 13l4 4L19 7"
    />
  </svg>
);

// --- Animation Variants ---
const buttonHoverTapVariants = {
  hover: {
    scale: 1.05,
    transition: { type: "spring", stiffness: 400, damping: 17 },
  },
  tap: { scale: 0.95 },
};

const listVariants = {
  visible: { transition: { staggerChildren: 0.05 } },
  hidden: {},
};

const listItemVariants = {
  visible: { opacity: 1, x: 0 },
  hidden: { opacity: 0, x: -20 },
};

// --- Stepper Component ---
interface StepperProps {
  steps: string[];
  currentStep: number;
}
const Stepper: React.FC<StepperProps> = ({ steps, currentStep }) => {
  return (
    <div className="flex items-center justify-between w-full mb-8 px-4">
      {steps.map((step, i) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center relative">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 z-10 ${
                currentStep > i
                  ? "bg-green-500 shadow-lg shadow-green-500/30"
                  : currentStep === i
                    ? "bg-indigo-500 shadow-lg shadow-indigo-500/30"
                    : "bg-gray-700"
              }`}
            >
              {currentStep > i ? (
                <CheckIcon />
              ) : (
                <span className="font-bold text-gray-200">{i + 1}</span>
              )}
            </div>
            <p
              className={`mt-2 text-xs sm:text-sm text-center font-semibold transition-colors duration-300 ${currentStep >= i ? "text-gray-200" : "text-gray-500"}`}
            >
              {step}
            </p>
          </div>
          {i < steps.length - 1 && (
            <div className="flex-1 h-1 bg-gray-700 mx-2 sm:mx-4 relative">
              {currentStep > i && (
                <motion.div
                  className="absolute top-0 left-0 h-1 bg-green-500"
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                />
              )}
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// --- FileUpload Component ---
interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, disabled }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      onFileSelect(file);
    }
  };

  const handlePasteFromClipboard = async () => {
    if (disabled) return;
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const file = new File([blob], "pasted-image.png", {
              type: blob.type,
            });
            onFileSelect(file);
            return;
          }
        }
      }
    } catch (err) {
      console.error("Failed to read clipboard contents: ", err);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) =>
    e.preventDefault();
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      className={`border-2 border-dashed rounded-xl transition-all duration-300 ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      } ${
        isDraggingOver
          ? "border-indigo-400 bg-indigo-500/10 ring-4 ring-indigo-500/20"
          : "border-gray-600 hover:border-indigo-500 bg-gray-900/50"
      }`}
    >
      <div className="px-6 py-10">
        <div className="text-center">
          <UploadIcon />
          <p className="mt-2 text-sm text-gray-400 font-semibold">
            Drag & drop your schedule image here
          </p>
          <div className="mt-4 space-y-2 sm:space-y-0 sm:flex sm:justify-center sm:space-x-4">
            <label
              htmlFor="file-upload"
              className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-indigo-300 bg-indigo-900/50 hover:bg-indigo-800/50 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 transition-all duration-200 ${disabled ? "pointer-events-none" : ""}`}
            >
              Choose file
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                className="sr-only"
                accept="image/*"
                onChange={handleFileChange}
                disabled={disabled}
              />
            </label>
            <button
              onClick={handlePasteFromClipboard}
              className={`inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium rounded-lg text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 ${disabled ? "pointer-events-none" : ""}`}
              disabled={disabled}
            >
              <PasteIcon /> Paste
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- StepCard Component ---
const StepCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    layout="position"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 25 }}
    className="bg-gray-800/60 backdrop-blur-md rounded-xl shadow-lg ring-1 ring-white/10"
  >
    <div className="p-6 sm:p-8">{children}</div>
  </motion.div>
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
  const [isApiReady, setIsApiReady] = useState(false);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [isSignedIn, setIsSignedIn] = useState(
    () => localStorage.getItem("isSignedIn") === "true",
  );
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(
    () => localStorage.getItem("selectedCalendarId") || null,
  );

  type AppStep = "CONFIG" | "UPLOAD" | "REVIEW" | "ADDING" | "DONE";
  const [appStep, setAppStep] = useState<AppStep>("CONFIG");

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
            body {
                font-family: 'Inter', sans-serif;
                background-color: #030712; /* bg-gray-950 */
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Cg fill-rule='evenodd'%3E%3Cg fill='%239CA3AF' fill-opacity='0.04'%3E%3Cpath d='M0 38.59l2.83-2.83 1.41 1.41L1.41 40H0v-1.41zM0 1.4l2.83 2.83 1.41-1.41L1.41 0H0v1.41zM38.59 40l-2.83-2.83 1.41-1.41L40 38.59V40h-1.41zM40 1.4l-2.83 2.83-1.41-1.41L38.59 0H40v1.41z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
            }
        `;
    document.head.appendChild(style);
  }, []);

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
    if (!isSignedIn || !isApiReady) return;
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
        `Failed to list calendars: ${e.result?.error?.message || e.message || "Unknown error"}`,
      );
    }
  }, [isSignedIn, selectedCalendarId, isApiReady]);

  useEffect(() => {
    const gapiScript = document.createElement("script");
    gapiScript.src = "https://apis.google.com/js/api.js";
    gapiScript.onload = () => {
      window.gapi.load("client", () => {
        window.gapi.client.init({}).then(() => {
          window.gapi.client.load("calendar", "v3").then(() => {
            const gisScript = document.createElement("script");
            gisScript.src = "https://accounts.google.com/gsi/client";
            gisScript.onload = () => {
              try {
                const client = window.google.accounts.oauth2.initTokenClient({
                  client_id: GOOGLE_CLIENT_ID,
                  scope: SCOPES,
                  callback: (tokenResponse: any) => {
                    if (tokenResponse && tokenResponse.access_token) {
                      window.gapi.client.setToken(tokenResponse);
                      setIsSignedIn(true);
                      setError(null);
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
                setIsApiReady(true);
              } catch (err: any) {
                console.error(
                  "Error initializing Google Identity Services:",
                  err,
                );
                setError(
                  `Failed to initialize sign-in service: ${err.message || "Unknown error"}`,
                );
              }
            };
            document.body.appendChild(gisScript);
          });
        });
      });
    };
    document.body.appendChild(gapiScript);
  }, []);

  useEffect(() => {
    if (isSignedIn && isApiReady) listCalendars();
  }, [isSignedIn, isApiReady, listCalendars]);

  const handleSignIn = () => {
    if (tokenClient) tokenClient.requestAccessToken();
    else
      setError(
        "Sign-in service is not ready yet. Please wait a moment and try again.",
      );
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

  const handleFileSelected = (file: File) => {
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setError(null);
      // Don't auto-advance. Let the user click 'Extract'.
    }
  };

  const checkForConflicts = async (shifts: Shift[]) => {
    if (!selectedCalendarId || shifts.length === 0)
      return shifts.map((s) => ({ ...s, selected: true }));
    setLoadingMessage("Checking for conflicting events...");
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
      if (existingEvents.length === 0)
        return shifts.map((shift) => ({ ...shift, selected: true }));
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
        return { ...shift, isConflicting, selected: true };
      });
      return updatedShifts;
    } catch (e: any) {
      console.error("Error checking for conflicts:", e);
      setError(
        `Could not check for calendar conflicts: ${e.result?.error?.message || "Unknown error"}`,
      );
      return shifts.map((shift) => ({ ...shift, selected: true }));
    }
  };

  const handleExtractShifts = async () => {
    if (!imageFile || !userName) return;
    setIsLoading(true);
    setLoadingMessage("AI is analyzing your schedule...");
    setError(null);
    try {
      const initialShifts = await extractShiftsFromImage(
        imageFile,
        userName,
        import.meta.env.VITE_API_KEY,
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
    if (!selectedCalendarId || extractedShifts.length === 0) return;
    const shiftsToAdd = extractedShifts.filter((s) => s.selected);
    if (shiftsToAdd.length === 0) {
      setError("No shifts selected to add.");
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
    setAppStep("CONFIG");
  };

  const handleToggleShift = (index: number) => {
    const newShifts = [...extractedShifts];
    newShifts[index].selected = !newShifts[index].selected;
    setExtractedShifts(newShifts);
  };

  // --- Step Navigation Logic ---
  const wizardSteps = ["Configuration", "Upload", "Review"];
  const getStepIndex = (step: AppStep) => {
    switch (step) {
      case "CONFIG":
        return 0;
      case "UPLOAD":
        return 1;
      case "REVIEW":
        return 2;
      case "ADDING":
        return 3;
      case "DONE":
        return 3;
      default:
        return 0;
    }
  };
  const currentStepIndex = getStepIndex(appStep);
  const handleBackToConfig = () => setAppStep("CONFIG");
  const handleBackToUpload = () => setAppStep("UPLOAD");

  const isConfigComplete =
    userName.trim() !== "" && isSignedIn && selectedCalendarId !== null;
  const getSignInButtonText = () => {
    if (!isApiReady) return "Initializing Sign-In...";
    return "Sign in with Google";
  };

  // --- Main Render ---
  return (
    <div className="min-h-screen text-gray-200 flex flex-col items-center py-8 px-4 sm:px-6 lg:px-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent tracking-tighter">
          Shift Sync AI
        </h1>
        <p className="mt-3 text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto">
          A simple 3-step wizard to get your schedule into your calendar.
        </p>
      </header>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg mb-6 w-full max-w-2xl lg:max-w-4xl flex items-center shadow-lg"
          >
            <ExclamationIcon className="h-5 w-5 text-red-400" />
            <span className="ml-3">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="w-full max-w-2xl lg:max-w-4xl space-y-6">
        {currentStepIndex < 3 && (
          <Stepper steps={wizardSteps} currentStep={currentStepIndex} />
        )}

        <AnimatePresence mode="wait">
          {appStep === "CONFIG" && (
            <StepCard key="config">
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
                      className="focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm bg-gray-700/50 border-gray-600 rounded-lg py-3 px-4 text-gray-200 placeholder-gray-500"
                      placeholder="e.g., אלכס, Alex, or אברהם"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Enter your name exactly as it appears on the schedule.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Google Calendar Connection
                  </label>
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
                        className="block w-full px-4 py-3 text-base bg-gray-700/50 border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 rounded-lg text-gray-200"
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
              <div className="flex justify-end pt-4 mt-6 border-t border-white/10">
                <motion.button
                  disabled={!isConfigComplete}
                  onClick={() => setAppStep("UPLOAD")}
                  variants={buttonHoverTapVariants}
                  whileHover="hover"
                  whileTap="tap"
                  className="w-full sm:w-auto px-6 py-3 border border-transparent rounded-lg shadow-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continue &rarr;
                </motion.button>
              </div>
            </StepCard>
          )}

          {appStep === "UPLOAD" && (
            <StepCard key="upload">
              <FileUpload
                onFileSelect={handleFileSelected}
                disabled={isLoading}
              />
              {imagePreview && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6"
                >
                  <p className="text-sm font-medium text-gray-300 mb-3">
                    Image Preview:
                  </p>
                  <div className="rounded-lg overflow-hidden shadow-lg">
                    <img
                      src={imagePreview}
                      alt="Schedule preview"
                      className="w-full h-auto max-h-80 object-contain bg-gray-900"
                    />
                  </div>
                </motion.div>
              )}
              <div className="flex justify-between items-center pt-4 mt-6 border-t border-white/10">
                <button
                  onClick={handleBackToConfig}
                  className="text-sm font-medium text-gray-400 hover:text-indigo-400 transition-colors"
                >
                  &larr; Back
                </button>
                {imageFile && (
                  <motion.button
                    onClick={handleExtractShifts}
                    disabled={isLoading || !imageFile}
                    variants={buttonHoverTapVariants}
                    whileHover="hover"
                    whileTap="tap"
                    className="w-full sm:w-auto flex items-center justify-center px-6 py-3 border border-transparent rounded-lg shadow-lg text-base font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {isLoading ? (
                      <>
                        <Spinner />
                        <span className="ml-3">{loadingMessage}</span>
                      </>
                    ) : (
                      <>✨ Extract Shifts with AI</>
                    )}
                  </motion.button>
                )}
              </div>
            </StepCard>
          )}

          {appStep === "REVIEW" && (
            <StepCard key="review">
              <div className="space-y-4">
                <div className="bg-green-900/50 border border-green-700 p-4 rounded-lg">
                  <p className="text-sm text-green-300">
                    Found{" "}
                    <span className="font-bold">{extractedShifts.length}</span>{" "}
                    shifts for <span className="font-semibold">{userName}</span>
                    . Uncheck any you don't want to add.
                  </p>
                </div>
                <div className="max-h-80 overflow-y-auto pr-2 -mr-2">
                  <motion.ul
                    className="space-y-3"
                    variants={listVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    {extractedShifts.map((shift, index) => (
                      <motion.li
                        key={index}
                        variants={listItemVariants}
                        whileHover={{
                          scale: 1.02,
                          transition: { duration: 0.2 },
                        }}
                        className={`p-4 rounded-lg border flex items-center space-x-4 transition-all duration-300 cursor-pointer ${shift.isConflicting ? "bg-red-900/50 border-red-700" : "bg-gray-900/50 border-gray-700"}`}
                        onClick={() => handleToggleShift(index)}
                      >
                        <div className="flex-shrink-0">
                          <div
                            className={`w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 ${shift.selected ? "bg-indigo-500 shadow-lg" : "bg-gray-700 border-2 border-gray-600"}`}
                          >
                            <AnimatePresence>
                              {shift.selected && (
                                <motion.svg
                                  initial={{ scale: 0, rotate: -90 }}
                                  animate={{ scale: 1, rotate: 0 }}
                                  exit={{ scale: 0, rotate: 90 }}
                                  transition={{
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 15,
                                  }}
                                  className="w-4 h-4 text-white"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="3"
                                    d="M5 13l4 4L19 7"
                                  />
                                </motion.svg>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                        <div className="flex-grow">
                          <p
                            className={`font-semibold ${shift.isConflicting ? "text-red-300" : "text-gray-200"}`}
                          >
                            {shift.date} ({shift.dayOfWeek})
                          </p>
                          <p
                            className={`text-sm ${shift.isConflicting ? "text-red-400" : "text-gray-400"}`}
                          >
                            {shift.startTime} - {shift.endTime} at{" "}
                            <span className="font-medium text-indigo-400">
                              {shift.location}
                            </span>
                            {shift.isConflicting && (
                              <span className="font-bold ml-2 text-yellow-400">
                                (Conflict)
                              </span>
                            )}
                          </p>
                        </div>
                      </motion.li>
                    ))}
                  </motion.ul>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-between items-center pt-4 mt-6 border-t border-white/10">
                <button
                  onClick={handleBackToUpload}
                  className="text-sm font-medium text-gray-400 hover:text-indigo-400 transition-colors mb-4 sm:mb-0"
                >
                  &larr; Back
                </button>
                <motion.button
                  onClick={handleAddShiftsToCalendar}
                  disabled={
                    extractedShifts.filter((s) => s.selected).length === 0
                  }
                  variants={buttonHoverTapVariants}
                  whileHover="hover"
                  whileTap="tap"
                  className="w-full sm:w-auto px-6 py-3 border border-transparent rounded-lg shadow-lg text-sm font-medium text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📅 Add to Calendar
                </motion.button>
              </div>
            </StepCard>
          )}

          {(appStep === "ADDING" || appStep === "DONE") && (
            <motion.div
              key="status"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="bg-gray-800/60 backdrop-blur-md rounded-xl shadow-lg ring-1 ring-white/10 p-8 text-center"
            >
              {appStep === "ADDING" ? (
                <>
                  <div className="flex justify-center mb-6">
                    <Spinner />
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
                    {extractedShifts.filter((s) => s.selected).length} shifts
                    have been added to your calendar.
                  </p>
                  <motion.button
                    onClick={handleStartOver}
                    variants={buttonHoverTapVariants}
                    whileHover="hover"
                    whileTap="tap"
                    className="mt-8 px-8 py-3 border border-transparent rounded-lg shadow-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                  >
                    Process Another Schedule
                  </motion.button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
