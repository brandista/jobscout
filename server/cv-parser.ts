// CV Parser - Extracts profile information from CV/Resume files
import { ENV } from './_core/env';

interface ParsedCVData {
  currentTitle?: string;
  yearsOfExperience?: number;
  skills?: string[];
  languages?: string[];
  certifications?: string[];
  degree?: string;
  field?: string;
  university?: string;
  graduationYear?: number;
}

export async function parseCVWithAI(
  fileBase64: string,
  fileName: string,
  fileType: string
): Promise<ParsedCVData> {
  // Extract text from file
  let text: string;
  
  if (fileType === 'application/pdf') {
    text = await extractTextFromPDF(fileBase64);
  } else {
    // For DOC/DOCX, use a simpler approach - extract any readable text
    text = await extractTextFromDoc(fileBase64);
  }

  if (!text || text.trim().length < 50) {
    throw new Error('Could not extract enough text from the file');
  }

  // Use AI to parse the CV text
  const parsedData = await parseWithOpenAI(text);
  
  return parsedData;
}

async function extractTextFromPDF(base64Data: string): Promise<string> {
  try {
    // Dynamic import for pdf-parse
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = Buffer.from(base64Data, 'base64');
    const data = await pdfParse(buffer);
    return data.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF file');
  }
}

async function extractTextFromDoc(base64Data: string): Promise<string> {
  try {
    // For DOCX files, we can try mammoth
    const mammoth = await import('mammoth');
    const buffer = Buffer.from(base64Data, 'base64');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('DOC parsing error:', error);
    // Fallback: try to extract readable text from base64
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      const text = buffer.toString('utf-8');
      // Filter out non-printable characters
      return text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ');
    } catch {
      throw new Error('Failed to parse document file');
    }
  }
}

async function parseWithOpenAI(cvText: string): Promise<ParsedCVData> {
  const openaiKey = ENV.openaiApiKey;
  
  if (!openaiKey) {
    console.warn('OpenAI API key not configured, returning empty data');
    return {};
  }

  const prompt = `Analyze the following CV/Resume text and extract the following information in JSON format:
- currentTitle: The person's current or most recent job title
- yearsOfExperience: Estimated total years of professional experience (number)
- skills: Array of technical and professional skills mentioned
- languages: Array of spoken languages
- certifications: Array of professional certifications
- degree: Highest education degree (e.g., "Bachelor's", "Master's", "PhD")
- field: Field of study
- university: Name of the educational institution
- graduationYear: Year of graduation (number)

If any field cannot be determined from the text, omit it from the response.

CV Text:
${cvText.substring(0, 8000)}

Respond with ONLY valid JSON, no explanations or markdown:`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a CV/Resume parser. Extract structured data from CV text and return valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error('AI parsing failed');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    // Parse the JSON response
    try {
      // Clean up potential markdown code blocks
      const cleanedContent = content
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/gi, '')
        .trim();
      
      const parsed = JSON.parse(cleanedContent);
      
      // Validate and sanitize the response
      return {
        currentTitle: typeof parsed.currentTitle === 'string' ? parsed.currentTitle : undefined,
        yearsOfExperience: typeof parsed.yearsOfExperience === 'number' ? parsed.yearsOfExperience : undefined,
        skills: Array.isArray(parsed.skills) ? parsed.skills.filter((s: any) => typeof s === 'string') : undefined,
        languages: Array.isArray(parsed.languages) ? parsed.languages.filter((l: any) => typeof l === 'string') : undefined,
        certifications: Array.isArray(parsed.certifications) ? parsed.certifications.filter((c: any) => typeof c === 'string') : undefined,
        degree: typeof parsed.degree === 'string' ? parsed.degree : undefined,
        field: typeof parsed.field === 'string' ? parsed.field : undefined,
        university: typeof parsed.university === 'string' ? parsed.university : undefined,
        graduationYear: typeof parsed.graduationYear === 'number' ? parsed.graduationYear : undefined,
      };
    } catch (parseError) {
      console.error('JSON parse error:', parseError, 'Content:', content);
      throw new Error('Failed to parse AI response');
    }
  } catch (error) {
    console.error('OpenAI request error:', error);
    throw error;
  }
}

// Simple CV text extraction for agent chat
export async function parseCV(base64WithPrefix: string, fileName: string): Promise<string | null> {
  try {
    // Remove data:xxx;base64, prefix if present
    const base64Data = base64WithPrefix.includes(',') 
      ? base64WithPrefix.split(',')[1] 
      : base64WithPrefix;

    const fileType = fileName.toLowerCase();
    
    if (fileType.endsWith('.pdf')) {
      const pdfParse = (await import('pdf-parse')).default;
      const buffer = Buffer.from(base64Data, 'base64');
      const data = await pdfParse(buffer);
      return data.text;
    } else if (fileType.endsWith('.txt')) {
      const buffer = Buffer.from(base64Data, 'base64');
      return buffer.toString('utf-8');
    } else if (fileType.endsWith('.docx')) {
      // For DOCX, try mammoth
      try {
        const mammoth = await import('mammoth');
        const buffer = Buffer.from(base64Data, 'base64');
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      } catch {
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[CV Parser] Error:', error);
    return null;
  }
}
