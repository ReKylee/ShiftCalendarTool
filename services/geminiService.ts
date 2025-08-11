import { GoogleGenAI, Type } from "@google/genai";
import { Shift } from '../types';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        date: {
          type: Type.STRING,
          description: "The full date of the shift in YYYY-MM-DD format. The year is 2025 as seen in the image. Extract the date from the far left column of the row where the shift is found.",
        },
        dayOfWeek: {
          type: Type.STRING,
          description: "The day of the week in Hebrew (e.g., 'ראשון', 'שני') from the left column.",
        },
        startTime: {
          type: Type.STRING,
          description: "The shift's start time in 24-hour HH:mm format.",
        },
        endTime: {
          type: Type.STRING,
          description: "The shift's end time in 24-hour HH:mm format.",
        },
        location: {
          type: Type.STRING,
          description: "The location/store of the shift (e.g., 'ASICS', 'ORIGINALS'). This is found in the column header for the shift.",
        }
      },
      required: ["date", "startTime", "endTime", "location", "dayOfWeek"],
    }
  };


export const extractShiftsFromImage = async (imageFile: File, userName: string, apiKey: string): Promise<Shift[]> => {
  if (!apiKey || apiKey.startsWith('%%')) {
    throw new Error("Application is not configured correctly. The API_KEY is missing or has not been injected.");
  }
  const ai = new GoogleGenAI({ apiKey });
  
  const base64Image = await fileToBase64(imageFile);
  const imagePart = {
    inlineData: {
      mimeType: imageFile.type,
      data: base64Image,
    },
  };

  const textPart = {
    text: `Analyze this work schedule image. The user's name is '${userName}'. The text is a mix of Hebrew and English. Find all shifts assigned specifically to '${userName}'. For each shift, extract the full date from the leftmost column (the year is 2025), the start and end times from the cell, the Hebrew day of the week, and the location from the column header ('ASICS' or 'ORIGINALS'). Respond with a JSON array matching the provided schema. If no shifts are found for this name, return an empty array.`
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [textPart, imagePart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    const jsonText = response.text.trim();
    if (!jsonText) {
        return [];
    }
    const parsedShifts: Shift[] = JSON.parse(jsonText);
    return parsedShifts;

  } catch (error) {
    console.error("Error extracting shifts from image:", error);
    throw new Error("Failed to analyze the schedule. The AI model could not process the image.");
  }
};