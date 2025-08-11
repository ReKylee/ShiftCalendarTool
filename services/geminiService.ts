import { GoogleGenAI, Type } from "@google/genai";
import { Shift } from "../types";

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const extractShiftsFromImage = async (
  imageFile: File,
  userName: string,
  apiKey: string,
): Promise<Shift[]> => {
  if (!apiKey) {
    throw new Error(
      "Application is not configured correctly. The API_KEY is missing.",
    );
  }

  const genAI = new GoogleGenAI({
    apiKey: apiKey,
  });

  const base64Image = await fileToBase64(imageFile);

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            {
              text: `You are analyzing a work schedule table image with mixed Hebrew and English text. The image shows a weekly schedule with:

1. Date column on the left (showing dates like 17.08.25, 18.08.25, etc.) - the year is 2025
2. Hebrew days of the week (ראשון=Sunday, שני=Monday, שלישי=Tuesday, רביעי=Wednesday, חמישי=Thursday, שישי=Friday, שבת=Saturday)
3. Two main location columns: "ASICS" and "ORIGINALS"
4. Employee names in both Hebrew and English scattered throughout the cells
5. Time ranges in format like "15:30-22:00" or "9-16"

Your task:
- Find ALL shifts specifically assigned to the name "${userName}" (could be in Hebrew or English)
- The name might appear with slight variations or partial matches
- Extract the date from the leftmost column (convert DD.MM.YY format to YYYY-MM-DD, year is 2025)
- Extract Hebrew day of week from the schedule
- Extract start and end times (convert to HH:MM format, assume 24-hour format)
- Extract location from column headers (ASICS or ORIGINALS)
- Look carefully at colored cells as they often contain the employee assignments
- Be thorough - scan the entire image for any occurrence of the name

Example of time conversion:
- "15:30-22:00" → startTime: "15:30", endTime: "22:00"
- "9-16" → startTime: "09:00", endTime: "16:00"
- "12-22" → startTime: "12:00", endTime: "22:00"`,
            },
            {
              inlineData: {
                mimeType: imageFile.type,
                data: base64Image,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shifts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  date: {
                    type: Type.STRING,
                    description:
                      "The full date of the shift in YYYY-MM-DD format. Extract from the leftmost date column (year is 2025).",
                  },
                  dayOfWeek: {
                    type: Type.STRING,
                    description:
                      "The Hebrew day of the week from the schedule (e.g., 'ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת').",
                  },
                  startTime: {
                    type: Type.STRING,
                    description:
                      "The shift's start time in 24-hour HH:MM format.",
                  },
                  endTime: {
                    type: Type.STRING,
                    description:
                      "The shift's end time in 24-hour HH:MM format.",
                  },
                  location: {
                    type: Type.STRING,
                    description:
                      "The location/store of the shift from the column header (e.g., 'ASICS' or 'ORIGINALS').",
                  },
                },
                required: [
                  "date",
                  "startTime",
                  "endTime",
                  "location",
                  "dayOfWeek",
                ],
                propertyOrdering: [
                  "date",
                  "dayOfWeek",
                  "startTime",
                  "endTime",
                  "location",
                ],
              },
            },
          },
          required: ["shifts"],
          propertyOrdering: ["shifts"],
        },
      },
    });

    const responseText = response.text;
    console.log("Raw AI response:", responseText);

    if (!responseText) {
      return [];
    }

    const parsedResponse = JSON.parse(responseText);
    const shifts: Shift[] = parsedResponse.shifts || [];

    console.log("Extracted shifts:", shifts);

    // Validate and clean up the shifts
    return shifts.filter((shift) => {
      const hasRequiredFields =
        shift.date &&
        shift.startTime &&
        shift.endTime &&
        shift.location &&
        shift.dayOfWeek;
      const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(shift.date);
      const isValidTime =
        /^\d{2}:\d{2}$/.test(shift.startTime) &&
        /^\d{2}:\d{2}$/.test(shift.endTime);

      if (!hasRequiredFields) {
        console.warn("Shift missing required fields:", shift);
        return false;
      }

      if (!isValidDate) {
        console.warn("Invalid date format:", shift.date);
        return false;
      }

      if (!isValidTime) {
        console.warn("Invalid time format:", shift.startTime, shift.endTime);
        return false;
      }

      return true;
    });
  } catch (error) {
    console.error("Error extracting shifts from image:", error);

    if (error instanceof Error) {
      if (
        error.message.includes("API key") ||
        error.message.includes("authentication")
      ) {
        throw new Error(
          "Invalid API key. Please check your Google AI API key configuration.",
        );
      } else if (
        error.message.includes("quota") ||
        error.message.includes("limit")
      ) {
        throw new Error(
          "API quota exceeded. Please try again later or check your API usage limits.",
        );
      } else if (
        error.message.includes("blocked") ||
        error.message.includes("safety")
      ) {
        throw new Error(
          "Content was blocked by safety filters. Please try with a different image.",
        );
      } else if (error.message.includes("JSON")) {
        throw new Error(
          "AI response was not in valid JSON format. Please try again.",
        );
      }
    }

    throw new Error(
      "Failed to analyze the schedule. The AI model could not process the image. Please ensure the image is clear and contains a readable schedule.",
    );
  }
};

